// PHANTOM-Flow Threat Scanner CLI Tool
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/phantom-flow/internal/scanner"
	"github.com/phantom-flow/pkg/config"
)

var (
	configFile = flag.String("config", "config.yaml", "Configuration file path")
	target     = flag.String("target", "", "Target to scan (IP, domain, or network range)")
	scanType   = flag.String("type", "full", "Scan type: quick, full, deep, custom")
	output     = flag.String("output", "console", "Output format: console, json, xml, csv")
	verbose    = flag.Bool("verbose", false, "Enable verbose logging")
	workers    = flag.Int("workers", 10, "Number of concurrent workers")
	timeout    = flag.Duration("timeout", 30*time.Second, "Scan timeout per target")
)

func main() {
	flag.Parse()

	if *target == "" {
		fmt.Fprintf(os.Stderr, "Error: target is required\n")
		flag.Usage()
		os.Exit(1)
	}

	cfg, err := config.LoadConfig(*configFile)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	scanner := scanner.NewThreatScanner(cfg)
	scanner.SetVerbose(*verbose)
	scanner.SetWorkers(*workers)
	scanner.SetTimeout(*timeout)

	fmt.Printf("Starting threat scan of %s\n", *target)
	results, err := scanner.Scan(*target, *scanType)
	if err != nil {
		log.Fatalf("Scan failed: %v", err)
	}

	if err := scanner.OutputResults(results, *output); err != nil {
		log.Fatalf("Failed to output results: %v", err)
	}

	fmt.Printf("Scan completed. Found %d threats.\n", len(results.Threats))
}
