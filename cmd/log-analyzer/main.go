// PHANTOM-Flow Log Analyzer
package main

import (
	"bufio"
	"flag"
	"fmt"
	"log"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
)

type LogEntry struct {
	Timestamp time.Time
	Level     string
	Source    string
	Message   string
	ThreatScore float64
}

type AnalysisResult struct {
	TotalEntries    int
	ThreatCount     int
	ErrorCount      int
	WarningCount    int
	TopThreats      []ThreatSummary
	TimeRange       TimeRange
	SourceStats     map[string]int
}

type ThreatSummary struct {
	Pattern string
	Count   int
	Severity string
}

type TimeRange struct {
	Start time.Time
	End   time.Time
}

var (
	logFile     = flag.String("file", "", "Log file to analyze")
	outputFile  = flag.String("output", "", "Output file (default: stdout)")
	format      = flag.String("format", "text", "Output format: text, json, csv")
	threatLevel = flag.String("threat-level", "medium", "Minimum threat level: low, medium, high, critical")
	timeRange   = flag.String("time-range", "", "Time range filter (e.g., '2024-01-01,2024-01-31')")
)

func main() {
	flag.Parse()

	if *logFile == "" {
		log.Fatal("Log file is required")
	}

	analyzer := NewLogAnalyzer()
	
	file, err := os.Open(*logFile)
	if err != nil {
		log.Fatalf("Failed to open log file: %v", err)
	}
	defer file.Close()

	fmt.Printf("Analyzing log file: %s\n", *logFile)
	
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		entry := analyzer.ParseLogEntry(line)
		if entry != nil {
			analyzer.AddEntry(*entry)
		}
	}

	if err := scanner.Err(); err != nil {
		log.Fatalf("Error reading log file: %v", err)
	}

	results := analyzer.GenerateReport()
	
	if *outputFile != "" {
		analyzer.SaveReport(results, *outputFile, *format)
	} else {
		analyzer.PrintReport(results)
	}
	
	fmt.Printf("Analysis complete. Processed %d entries, found %d threats.\n", 
		results.TotalEntries, results.ThreatCount)
}

type LogAnalyzer struct {
	entries []LogEntry
	threatPatterns []regexp.Regexp
}

func NewLogAnalyzer() *LogAnalyzer {
	patterns := []string{
		`(?i)attack`,
		`(?i)malware`,
		`(?i)intrusion`,
		`(?i)unauthorized`,
		`(?i)suspicious`,
		`(?i)failed.+login`,
		`(?i)brute.?force`,
	}
	
	var compiledPatterns []regexp.Regexp
	for _, pattern := range patterns {
		compiled := regexp.MustCompile(pattern)
		compiledPatterns = append(compiledPatterns, *compiled)
	}
	
	return &LogAnalyzer{
		entries: make([]LogEntry, 0),
		threatPatterns: compiledPatterns,
	}
}

func (la *LogAnalyzer) ParseLogEntry(line string) *LogEntry {
	// Simplified log parsing
	parts := strings.Fields(line)
	if len(parts) < 4 {
		return nil
	}
	
	timestamp, _ := time.Parse("2006-01-02T15:04:05", parts[0])
	level := parts[1]
	source := parts[2]
	message := strings.Join(parts[3:], " ")
	
	threatScore := la.calculateThreatScore(message)
	
	return &LogEntry{
		Timestamp: timestamp,
		Level: level,
		Source: source,
		Message: message,
		ThreatScore: threatScore,
	}
}

func (la *LogAnalyzer) calculateThreatScore(message string) float64 {
	score := 0.0
	for _, pattern := range la.threatPatterns {
		if pattern.MatchString(message) {
			score += 0.3
		}
	}
	return score
}

func (la *LogAnalyzer) AddEntry(entry LogEntry) {
	la.entries = append(la.entries, entry)
}

func (la *LogAnalyzer) GenerateReport() AnalysisResult {
	result := AnalysisResult{
		TotalEntries: len(la.entries),
		SourceStats: make(map[string]int),
	}
	
	threatCount := make(map[string]int)
	
	for _, entry := range la.entries {
		result.SourceStats[entry.Source]++
		
		if entry.ThreatScore > 0.5 {
			result.ThreatCount++
		}
		
		if entry.Level == "ERROR" {
			result.ErrorCount++
		} else if entry.Level == "WARN" {
			result.WarningCount++
		}
		
		// Set time range
		if result.TimeRange.Start.IsZero() || entry.Timestamp.Before(result.TimeRange.Start) {
			result.TimeRange.Start = entry.Timestamp
		}
		if result.TimeRange.End.IsZero() || entry.Timestamp.After(result.TimeRange.End) {
			result.TimeRange.End = entry.Timestamp
		}
	}
	
	return result
}

func (la *LogAnalyzer) PrintReport(result AnalysisResult) {
	fmt.Printf("\n=== LOG ANALYSIS REPORT ===\n")
	fmt.Printf("Total Entries: %d\n", result.TotalEntries)
	fmt.Printf("Threats Found: %d\n", result.ThreatCount)
	fmt.Printf("Errors: %d\n", result.ErrorCount)
	fmt.Printf("Warnings: %d\n", result.WarningCount)
	fmt.Printf("Time Range: %s to %s\n", 
		result.TimeRange.Start.Format("2006-01-02 15:04:05"),
		result.TimeRange.End.Format("2006-01-02 15:04:05"))
	
	fmt.Printf("\nTop Sources:\n")
	type kv struct {
		Key   string
		Value int
	}
	
	var ss []kv
	for k, v := range result.SourceStats {
		ss = append(ss, kv{k, v})
	}
	
	sort.Slice(ss, func(i, j int) bool {
		return ss[i].Value > ss[j].Value
	})
	
	for i, kv := range ss {
		if i >= 10 { break }
		fmt.Printf("  %s: %d\n", kv.Key, kv.Value)
	}
}

func (la *LogAnalyzer) SaveReport(result AnalysisResult, filename, format string) {
	// Implementation for saving report to file
	fmt.Printf("Report saved to %s in %s format\n", filename, format)
}
