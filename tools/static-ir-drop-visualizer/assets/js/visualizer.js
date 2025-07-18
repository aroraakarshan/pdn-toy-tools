// Static IR Drop Visualizer Application Controller

class IRDropVisualizer {
    constructor() {
        this.grid = null;
        this.irEngine = null;
        this.animationEngine = null;
        this.currentSource = null;
        this.currentValue = 100; // mA
        this.showVoltages = true;
        this.showCurrentFlow = true;
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
        this.animationEngine = new AnimationEngine();
    }
    
    setupEventListeners() {
        // Animation speed control
        document.getElementById('animationSpeed').addEventListener('input', (e) => {
            const speed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = speed + 'x';
            if (this.animationEngine) {
                this.animationEngine.setSpeed(speed);
            }
        });
        
        // Current value control
        document.getElementById('currentValue').addEventListener('input', (e) => {
            this.currentValue = parseInt(e.target.value);
            document.getElementById('currentDisplay').textContent = this.currentValue + 'mA';
        });
        
        // Button events
        document.getElementById('generateNetwork').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.generateFixedGrid();
                this.updateCurrentSourceDropdown();
            }
        });
        
        document.getElementById('simulateIR').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.simulateIRDrop();
            }
        });
        
        document.getElementById('clearSimulation').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.clearSimulation();
            }
        });
        
        document.getElementById('animateFlow').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.animateCurrentFlow();
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
        
        document.getElementById('showCurrentFlow').addEventListener('change', (e) => {
            this.showCurrentFlow = e.target.checked;
            if (window.plotlyGrid) {
                window.plotlyGrid.toggleCurrentFlowDisplay(this.showCurrentFlow);
            }
        });
        
        // Current source selection
        document.getElementById('currentSource').addEventListener('change', (e) => {
            this.currentSource = e.target.value;
            if (window.plotlyGrid) {
                window.plotlyGrid.selectCurrentSource(this.currentSource);
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
        setTimeout(() => {
            this.updateCurrentSourceDropdown();
        }, 100);
    }
    
    updateCurrentSourceDropdown() {
        const select = document.getElementById('currentSource');
        select.innerHTML = '<option value="">Select current source...</option>';
        
        if (window.plotlyGrid && window.plotlyGrid.instances) {
            window.plotlyGrid.instances.forEach((instance) => {
                const option = document.createElement('option');
                option.value = instance.id;
                option.textContent = `Instance ${instance.id}`;
                select.appendChild(option);
            });
        }
    }
    
    resetVisualization() {
        this.currentSource = null;
        this.simulationActive = false;
        document.getElementById('currentSource').value = '';
        document.getElementById('currentValue').value = 100;
        document.getElementById('currentDisplay').textContent = '100mA';
        
        if (window.plotlyGrid) {
            window.plotlyGrid.clearSimulation();
        }
        
        this.updateAnalysisResults();
    }
    
    updateAnalysisResults(results = null) {
        const resultsDiv = document.getElementById('analysisResults');
        
        if (!results) {
            resultsDiv.innerHTML = '<p>Select a current source to see IR drop analysis</p>';
            return;
        }
        
        resultsDiv.innerHTML = `
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
    
    getShowVoltages() {
        return this.showVoltages;
    }
    
    getShowCurrentFlow() {
        return this.showCurrentFlow;
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
