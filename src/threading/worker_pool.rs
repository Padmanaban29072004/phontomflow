// PHANTOM-Flow High-Performance Worker Pool
// Concurrent task execution for security operations

use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::{Duration, Instant};
use crossbeam_channel::{bounded, Receiver, Sender};

pub struct WorkerPool {
    workers: Vec<Worker>,
    sender: Option<Sender<Job>>,
    stats: Arc<Mutex<PoolStats>>,
}

type Job = Box<dyn FnOnce() + Send + 'static>;

struct Worker {
    id: usize,
    thread: Option<thread::JoinHandle<()>>,
}

#[derive(Debug, Default)]
pub struct PoolStats {
    pub tasks_submitted: u64,
    pub tasks_completed: u64,
    pub tasks_failed: u64,
    pub workers_active: usize,
    pub average_task_time: Duration,
    pub peak_queue_size: usize,
    pub total_execution_time: Duration,
}

impl WorkerPool {
    pub fn new(size: usize) -> WorkerPool {
        assert!(size > 0);

        let (sender, receiver) = bounded(1000);
        let receiver = Arc::new(Mutex::new(receiver));
        let stats = Arc::new(Mutex::new(PoolStats::default()));

        let mut workers = Vec::with_capacity(size);

        for id in 0..size {
            workers.push(Worker::new(id, Arc::clone(&receiver), Arc::clone(&stats)));
        }

        stats.lock().unwrap().workers_active = size;

        WorkerPool {
            workers,
            sender: Some(sender),
            stats,
        }
    }

    pub fn execute<F>(&self, f: F) -> Result<(), PoolError>
    where
        F: FnOnce() + Send + 'static,
    {
        let job = Box::new(f);
        
        if let Some(ref sender) = self.sender {
            match sender.try_send(job) {
                Ok(_) => {
                    self.stats.lock().unwrap().tasks_submitted += 1;
                    Ok(())
                }
                Err(_) => Err(PoolError::QueueFull),
            }
        } else {
            Err(PoolError::PoolShutdown)
        }
    }

    pub fn execute_with_timeout<F>(&self, f: F, timeout: Duration) -> Result<(), PoolError>
    where
        F: FnOnce() + Send + 'static,
    {
        let job = Box::new(f);
        
        if let Some(ref sender) = self.sender {
            match sender.send_timeout(job, timeout) {
                Ok(_) => {
                    self.stats.lock().unwrap().tasks_submitted += 1;
                    Ok(())
                }
                Err(_) => Err(PoolError::Timeout),
            }
        } else {
            Err(PoolError::PoolShutdown)
        }
    }

    pub fn get_stats(&self) -> PoolStats {
        self.stats.lock().unwrap().clone()
    }

    pub fn resize(&mut self, new_size: usize) -> Result<(), PoolError> {
        if new_size == 0 {
            return Err(PoolError::InvalidSize);
        }

        let current_size = self.workers.len();
        
        if new_size > current_size {
            // Add more workers
            if let Some(ref sender) = self.sender {
                let receiver = Arc::new(Mutex::new(sender.clone()));
                
                for id in current_size..new_size {
                    self.workers.push(Worker::new(id, receiver.clone(), Arc::clone(&self.stats)));
                }
            }
        } else if new_size < current_size {
            // Remove workers - this is simplified and doesn't actually stop threads
            self.workers.truncate(new_size);
        }

        self.stats.lock().unwrap().workers_active = new_size;
        Ok(())
    }

    pub fn queue_size(&self) -> usize {
        if let Some(ref sender) = self.sender {
            sender.len()
        } else {
            0
        }
    }

    pub fn is_idle(&self) -> bool {
        self.queue_size() == 0
    }
}

impl Drop for WorkerPool {
    fn drop(&mut self) {
        drop(self.sender.take());

        for worker in &mut self.workers {
            if let Some(thread) = worker.thread.take() {
                thread.join().unwrap();
            }
        }
    }
}

impl Worker {
    fn new(
        id: usize,
        receiver: Arc<Mutex<Receiver<Job>>>,
        stats: Arc<Mutex<PoolStats>>,
    ) -> Worker {
        let thread = thread::spawn(move || loop {
            let job = {
                let receiver = receiver.lock().unwrap();
                receiver.recv()
            };

            match job {
                Ok(job) => {
                    let start_time = Instant::now();
                    
                    // Execute the job
                    job();
                    
                    let execution_time = start_time.elapsed();
                    
                    // Update statistics
                    let mut stats = stats.lock().unwrap();
                    stats.tasks_completed += 1;
                    stats.total_execution_time += execution_time;
                    
                    // Update average task time
                    if stats.tasks_completed > 0 {
                        stats.average_task_time = stats.total_execution_time / stats.tasks_completed as u32;
                    }
                }
                Err(_) => {
                    // Channel closed, exit worker
                    break;
                }
            }
        });

        Worker {
            id,
            thread: Some(thread),
        }
    }
}

impl Clone for PoolStats {
    fn clone(&self) -> Self {
        Self {
            tasks_submitted: self.tasks_submitted,
            tasks_completed: self.tasks_completed,
            tasks_failed: self.tasks_failed,
            workers_active: self.workers_active,
            average_task_time: self.average_task_time,
            peak_queue_size: self.peak_queue_size,
            total_execution_time: self.total_execution_time,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PoolError {
    #[error("Worker pool queue is full")]
    QueueFull,
    #[error("Worker pool has been shutdown")]
    PoolShutdown,
    #[error("Operation timed out")]
    Timeout,
    #[error("Invalid pool size")]
    InvalidSize,
}

pub struct ThreadSafeQueue<T> {
    queue: Arc<Mutex<Vec<T>>>,
    capacity: usize,
}

impl<T> ThreadSafeQueue<T> {
    pub fn new(capacity: usize) -> Self {
        Self {
            queue: Arc::new(Mutex::new(Vec::with_capacity(capacity))),
            capacity,
        }
    }

    pub fn push(&self, item: T) -> Result<(), QueueError> {
        let mut queue = self.queue.lock().unwrap();
        if queue.len() >= self.capacity {
            return Err(QueueError::Full);
        }
        queue.push(item);
        Ok(())
    }

    pub fn pop(&self) -> Option<T> {
        let mut queue = self.queue.lock().unwrap();
        queue.pop()
    }

    pub fn len(&self) -> usize {
        self.queue.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.lock().unwrap().is_empty()
    }

    pub fn clear(&self) {
        self.queue.lock().unwrap().clear();
    }
}

#[derive(Debug, thiserror::Error)]
pub enum QueueError {
    #[error("Queue is full")]
    Full,
    #[error("Queue is empty")]
    Empty,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn test_worker_pool_execution() {
        let pool = WorkerPool::new(4);
        let counter = Arc::new(AtomicUsize::new(0));

        for _ in 0..10 {
            let counter = Arc::clone(&counter);
            pool.execute(move || {
                counter.fetch_add(1, Ordering::SeqCst);
            }).unwrap();
        }

        // Wait for all tasks to complete
        thread::sleep(Duration::from_millis(100));
        
        assert_eq!(counter.load(Ordering::SeqCst), 10);
    }

    #[test]
    fn test_thread_safe_queue() {
        let queue = ThreadSafeQueue::new(5);
        
        assert!(queue.push(1).is_ok());
        assert!(queue.push(2).is_ok());
        assert_eq!(queue.len(), 2);
        
        assert_eq!(queue.pop(), Some(2));
        assert_eq!(queue.pop(), Some(1));
        assert_eq!(queue.pop(), None);
    }
}
