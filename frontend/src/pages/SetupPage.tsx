import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { DEFAULT_APP_ROUTE } from '../config/routes'
import toast from 'react-hot-toast'
import {
  GlobeAltIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

const SCAN_STEPS = [
  { id: 1, label: 'Ingesting target system endpoints...' },
  { id: 2, label: 'Mapping MITRE ATT&CK vectors...' },
  { id: 3, label: 'Activating honeypots & deception traps...' },
  { id: 4, label: 'Injecting Thompson Sampling feedback loop...' },
  { id: 5, label: 'Connection established! Entering dashboard...' },
]

export function SetupPage() {
  const { targetUrl, setTargetUrl } = useAuth()
  const navigate = useNavigate()
  const [urlInput, setUrlInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  useEffect(() => {
    if (targetUrl) {
      navigate(DEFAULT_APP_ROUTE, { replace: true })
    }
  }, [targetUrl, navigate])

  const handleAnalyse = (e: React.FormEvent) => {
    e.preventDefault()
    
    // basic validation
    let formattedUrl = urlInput.trim()
    if (!formattedUrl) {
      toast.error('Please enter a target URL')
      return
    }

    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl
    }

    try {
      new URL(formattedUrl)
    } catch {
      toast.error('Please enter a valid URL')
      return
    }

    setIsAnalyzing(true)
    setProgress(0)
    setCurrentStepIndex(0)
  }

  useEffect(() => {
    if (!isAnalyzing) return

    const totalSteps = SCAN_STEPS.length
    const durationPerStep = 700 // ms
    const totalDuration = totalSteps * durationPerStep

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 1
        if (next >= 100) {
          clearInterval(interval)
          return 100
        }
        return next
      })
    }, totalDuration / 100)

    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev >= totalSteps - 1) {
          clearInterval(stepInterval)
          return totalSteps - 1
        }
        return prev + 1
      })
    }, durationPerStep)

    return () => {
      clearInterval(interval)
      clearInterval(stepInterval)
    }
  }, [isAnalyzing])

  // Redirect on finish
  useEffect(() => {
    if (progress === 100) {
      const timeout = setTimeout(() => {
        let formattedUrl = urlInput.trim()
        if (!/^https?:\/\//i.test(formattedUrl)) {
          formattedUrl = 'https://' + formattedUrl
        }
        setTargetUrl(formattedUrl)
        toast.success(`Active monitoring established for ${formattedUrl}`)
        navigate(DEFAULT_APP_ROUTE, { replace: true })
      }, 500)
      return () => clearTimeout(timeout)
    }
  }, [progress, navigate, setTargetUrl, urlInput])

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <div className="m-auto w-full max-w-lg px-4 py-8">
        <div className="rounded-2xl border border-gray-800 bg-gray-950 p-8 shadow-2xl">
          
          {/* Logo & Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
              <GlobeAltIcon className="h-8 w-8 text-white animate-pulse" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Target Environment
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Ingest website logs and launch threat response engine.
            </p>
          </div>

          {!isAnalyzing ? (
            <form onSubmit={handleAnalyse} className="space-y-6">
              <div>
                <label htmlFor="url" className="mb-2 block text-sm font-semibold text-gray-300">
                  Target Website URL
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <GlobeAltIcon className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    type="text"
                    id="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-800 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-500 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder="e.g. security-target.corp"
                    autoFocus
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  PHANTOM-Flow will monitor network logs, behavioral anomaly triggers, and deception traps on this domain.
                </p>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/40 active:scale-[0.98]"
              >
                Analyse Target
              </button>
            </form>
          ) : (
            <div className="space-y-6 py-2">
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span className="font-semibold text-blue-400">Analysis In Progress...</span>
                <span>{progress}%</span>
              </div>
              
              {/* Progress Bar */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 transition-all duration-100 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Scanning Steps */}
              <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
                {SCAN_STEPS.map((step, idx) => {
                  const isCompleted = idx < currentStepIndex
                  const isCurrent = idx === currentStepIndex
                  
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                        isCompleted ? 'text-green-400' : isCurrent ? 'text-white' : 'text-gray-600'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-green-400" />
                      ) : isCurrent ? (
                        <ArrowPathIcon className="h-5 w-5 flex-shrink-0 animate-spin text-blue-500" />
                      ) : (
                        <div className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-gray-800" />
                      )}
                      <span className={isCurrent ? 'font-medium' : ''}>{step.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
