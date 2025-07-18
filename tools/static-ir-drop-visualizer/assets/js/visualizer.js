// Static IR Drop Visualizer Application Controller

class IRDropVisualizer {
    constructor() {
        this.grid = null;
        this.irEngine = null;
        this.currentSource = null;
        this.currentValue = 100; // mA
        this.selectedSources = new Map(); // Map of instance ID to current value
        this.showVoltages = true;
        this.tooltip = null;
        this.simulationActive = false;
        
        this.initializeApp();
        this.setupEventListeners();
        this.generateInitialGrid();
    }
    
    initializeApp() {
        // Initialize Plotly grid visualizer
        window.plotlyGrid = new PlotlyGridVisualizer('irDropPlot');
        this.tooltip = document.getElementById('tooltipDisplay');
        this.setupTooltip();
        
        // Initialize IR drop engine
        this.irEngine = new IRDropEngine();
    }
    
    setupEventListeners() {
        // Button events
        document.getElementById('generateNetwork').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.generateFixedGrid();
            }
        });
        
        document.getElementById('simulateIR').addEventListener('click', () => {
            // Get selected sources from the multi-source interface
            this.updateSelectedSources();
            
            if (window.plotlyGrid) {
                window.plotlyGrid.simulateMultiSourceIRDrop(this.selectedSources);
            }
        });
        
        document.getElementById('clearSimulation').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.clearSimulation();
            }
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetVisualization();
        });
        
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.showHelp();
        });
        
        // Checkbox events
        document.getElementById('showVoltages').addEventListener('change', (e) => {
            this.showVoltages = e.target.checked;
            if (window.plotlyGrid) {
                window.plotlyGrid.toggleVoltageDisplay(this.showVoltages);
            }
        });
        
        // Modal events
        this.setupModalEvents();
        
        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    setupTooltip() {
        // Tooltip functionality will be handled by the plotly grid
    }
    
    setupModalEvents() {
        // Close modal when clicking outside
        document.getElementById('helpModal').addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') {
                this.hideHelp();
            }
        });
        
        // Close modal with escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideHelp();
            }
        });
    }
    
    generateInitialGrid() {
        // Initial grid generation happens in the constructor
        // Multi-source interface doesn't need dropdown updates
    }
    
    updateSelectedSources() {
        this.selectedSources.clear();
        
        // Get all checked source checkboxes
        const checkedSources = document.querySelectorAll('.source-checkbox:checked');
        
        checkedSources.forEach(checkbox => {
            const instanceId = checkbox.getAttribute('data-instance-id');
            const slider = document.getElementById(`current-${instanceId}`);
            const currentValue = parseInt(slider.value);
            
            this.selectedSources.set(instanceId, currentValue);
        });
        
        console.log('Selected sources:', Array.from(this.selectedSources.entries()));
        console.log('Available instances:', window.plotlyGrid ? window.plotlyGrid.instances.map(i => i.id) : 'no instances');
    }
    
    resetVisualization() {
        this.currentSource = null;
        this.simulationActive = false;
        this.selectedSources.clear();
        
        // Uncheck all source checkboxes and hide controls
        document.querySelectorAll('.source-checkbox').forEach(checkbox => {
            checkbox.checked = false;
            const controls = checkbox.closest('.source-item').querySelector('.source-controls');
            controls.style.display = 'none';
        });
        
        if (window.plotlyGrid) {
            window.plotlyGrid.clearSimulation();
        }
        
        this.updateAnalysisResults();
    }
    
    updateAnalysisResults(results = null) {
        const resultsDiv = document.getElementById('analysisResults');
        
        if (!results) {
            resultsDiv.innerHTML = `
                <div class="result-item">
                    <span class="result-label">Supply Voltage:</span>
                    <span class="result-value">1.0V</span>
                </div>
                <p style="margin-top: 0.75rem; color: var(--text-secondary);">
                    Select current sources and click "Simulate IR Drop" to see detailed analysis
                </p>
            `;
            return;
        }
        
        resultsDiv.innerHTML = `
            <div class="result-item">
                <span class="result-label">Supply Voltage:</span>
                <span class="result-value">1.0V</span>
            </div>
            <div class="result-item">
                <span class="result-label">Current Source:</span>
                <span class="result-value">${results.source}</span>
            </div>
            <div class="result-item">
                <span class="result-label">Input Current:</span>
                <span class="result-value">${results.current}mA</span>
            </div>
            <div class="result-item">
                <span class="result-label">Max IR Drop:</span>
                <span class="result-value">${results.maxIRDrop}mV</span>
            </div>
            <div class="result-item">
                <span class="result-label">Min Voltage:</span>
                <span class="result-value">${results.minVoltage}V</span>
            </div>
            <div class="result-item">
                <span class="result-label">Power Loss:</span>
                <span class="result-value">${results.powerLoss}mW</span>
            </div>
        `;
    }
    
    showHelp() {
        document.getElementById('helpModal').classList.add('active');
    }
    
    hideHelp() {
        document.getElementById('helpModal').classList.remove('active');
    }
    
    resizeCanvas() {
        if (window.plotlyGrid) {
            window.plotlyGrid.resize();
        }
    }
    
    // Public methods for external access
    getCurrentSource() {
        return this.currentSource;
    }
    
    getCurrentValue() {
        return this.currentValue;
    }
    
    getSelectedSources() {
        return this.selectedSources;
    }
    
    getShowVoltages() {
        return this.showVoltages;
    }
    
    setSimulationActive(active) {
        this.simulationActive = active;
    }
    
    isSimulationActive() {
        return this.simulationActive;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.irDropVisualizer = new IRDropVisualizer();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IRDropVisualizer;
}
