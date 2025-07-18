// Plotly-based Grid Visualization for Static IR Drop Analysis

class PlotlyGridVisualizer {
    constructor(containerId) {
        this.containerId = containerId;
        this.grid = null;
        this.gridSize = { rows: 10, cols: 10 };
        this.domains = [];
        this.instances = [];
        this.currentSource = null;
        this.voltageMap = null;
        this.currentFlowMap = null;
        this.showVoltages = true;
        this.showCurrentFlow = true;
        
        // Animation tracking
        this.animationTimeouts = [];
        this.animationIntervals = [];
        
        this.initializePlot();
        this.generateFixedGrid(); // Auto-generate circuit on page load
    }
    
    initializePlot() {
        // Create empty plot
        const layout = {
            title: {
                text: 'PDN Grid Network',
                font: { size: 16 }
            },
            xaxis: {
                title: 'Column',
                dtick: 1,
                range: [-0.5, this.gridSize.cols - 0.5],
                showgrid: true,
                gridwidth: 1,
                gridcolor: '#e0e0e0'
            },
            yaxis: {
                title: 'Row',
                dtick: 1,
                range: [-0.5, this.gridSize.rows - 0.5],
                showgrid: true,
                gridwidth: 1,
                gridcolor: '#e0e0e0',
                scaleanchor: 'x',
                scaleratio: 1
            },
            showlegend: true,
            plot_bgcolor: '#f8f9fa',
            paper_bgcolor: 'white',
            margin: { l: 60, r: 40, t: 60, b: 60 },
            hovermode: 'closest',
            hoverdistance: 20
        };
        
        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
            displaylogo: false
        };
        
        Plotly.newPlot(this.containerId, [], layout, config);
        
        // Add click event listener
        document.getElementById(this.containerId).on('plotly_click', (data) => {
            this.handlePlotClick(data);
        });
    }
    
    generateFixedGrid() {
        // Clear existing data
        this.domains = [];
        this.instances = [];
        this.currentSource = null;
        this.voltageMap = null;
        this.currentFlowMap = null;
        
        // Create grid with non-uniform segment resistances
        this.gridResistances = [];
        for (let row = 0; row < this.gridSize.rows; row++) {
            this.gridResistances[row] = [];
            for (let col = 0; col < this.gridSize.cols; col++) {
                this.gridResistances[row][col] = {
                    right: col < this.gridSize.cols - 1 ? 0.05 + Math.random() * 0.15 : null, // 0.05-0.2Ω
                    down: row < this.gridSize.rows - 1 ? 0.05 + Math.random() * 0.15 : null   // 0.05-0.2Ω
                };
            }
        }
        
        // Generate 1 domain with 4 randomly placed bumps
        const colors = ['#FF6B6B'];
        const domainNames = ['Domain A'];
        
        // Track occupied grid positions to prevent overlapping
        const occupiedPositions = new Set();
        
        const domain = {
            id: 0,
            name: domainNames[0],
            color: colors[0],
            bumps: []
        };
        
        // Generate exactly 4 bumps for this domain
        const numBumps = 4;
        for (let b = 0; b < numBumps; b++) {
            const position = this.getAvailablePosition(occupiedPositions);
            if (position) {
                const bump = {
                    id: `bump-0-${b}`,
                    domainId: 0,
                    row: position.row,
                    col: position.col,
                    resistance: 0.01 + Math.random() * 0.04, // 0.01 - 0.05 ohms (very low for bumps)
                    type: 'bump'
                };
                domain.bumps.push(bump);
                occupiedPositions.add(`${position.row},${position.col}`);
            }
        }
        
        // Add virtual node for domain (represents the low-resistance domain connection)
        domain.virtualNode = {
            id: `virtual-0`,
            domainId: 0,
            row: -1, // Virtual position
            col: -1,
            resistance: 0.001, // Very low resistance (1mΩ)
            type: 'virtual'
        };
        
        this.domains.push(domain);
        
        // Generate 7 independent instances scattered across grid
        for (let i = 0; i < 7; i++) {
            const position = this.getAvailablePosition(occupiedPositions);
            if (position) {
                const instance = {
                    id: `instance-${i}`,
                    row: position.row,
                    col: position.col,
                    resistance: 0.3 + Math.random() * 1.7, // 0.3 - 2.0 ohms
                    type: 'instance'
                };
                this.instances.push(instance);
                occupiedPositions.add(`${position.row},${position.col}`);
            }
        }
        
        this.updatePlot();
    }
    
    getAvailablePosition(occupiedPositions) {
        // Try to find an available position on the grid
        const maxAttempts = 50;
        
        // Try random positions first
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const row = Math.floor(Math.random() * this.gridSize.rows);
            const col = Math.floor(Math.random() * this.gridSize.cols);
            const positionKey = `${row},${col}`;
            
            if (!occupiedPositions.has(positionKey)) {
                return { row, col };
            }
        }
        
        // If random attempts failed, do systematic search
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols; col++) {
                const positionKey = `${row},${col}`;
                if (!occupiedPositions.has(positionKey)) {
                    return { row, col };
                }
            }
        }
        
        return null;
    }
    
    updatePlot() {
        const traces = [];
        
        // Add grid network connections
        const gridX = [];
        const gridY = [];
        
        // Horizontal lines
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols - 1; col++) {
                gridX.push(col, col + 1, null);
                gridY.push(row, row, null);
            }
        }
        
        // Vertical lines
        for (let col = 0; col < this.gridSize.cols; col++) {
            for (let row = 0; row < this.gridSize.rows - 1; row++) {
                gridX.push(col, col, null);
                gridY.push(row, row + 1, null);
            }
        }
        
        // Grid lines trace
        traces.push({
            x: gridX,
            y: gridY,
            mode: 'lines',
            line: { color: '#ddd', width: 1 },
            name: 'Grid Network',
            showlegend: true,
            hoverinfo: 'skip'
        });
        
        // Add voltage heatmap if simulation is active
        if (this.voltageMap) {
            const heatmapTrace = this.createHeatmapTrace();
            traces.push(heatmapTrace);
        }
        
        // Add domain bumps
        this.domains.forEach((domain, domainIndex) => {
            const x = domain.bumps.map(bump => bump.col);
            const y = domain.bumps.map(bump => bump.row);
            const text = domain.bumps.map(bump => 
                `Bump ${bump.id}<br>Domain: ${domain.name}<br>Resistance: ${bump.resistance.toFixed(3)}Ω`
            );
            
            traces.push({
                x: x,
                y: y,
                mode: 'markers',
                marker: {
                    color: domain.color,
                    size: 14,
                    symbol: 'circle',
                    line: { color: '#2c3e50', width: 3 }
                },
                name: `${domain.name} Bumps`,
                text: text,
                hoverinfo: 'text',
                customdata: domain.bumps.map(bump => ({ type: 'bump', data: bump }))
            });
        });
        
        // Add independent instances
        const instanceX = this.instances.map(inst => inst.col);
        const instanceY = this.instances.map(inst => inst.row);
        const instanceText = this.instances.map(inst => 
            `Instance ${inst.id}<br>Independent Node<br>Resistance: ${inst.resistance.toFixed(3)}Ω`
        );
        const instanceNumbers = this.instances.map(inst => inst.id.split('-')[1]);
        
        traces.push({
            x: instanceX,
            y: instanceY,
            mode: 'markers+text',
            marker: {
                color: '#9B59B6',
                size: 16,
                symbol: 'square',
                line: { color: '#663399', width: 2 }
            },
            text: instanceNumbers,
            textposition: 'middle center',
            textfont: {
                color: 'white',
                size: 10,
                family: 'Arial Black'
            },
            name: 'Instances',
            hovertext: instanceText,
            hoverinfo: 'text',
            customdata: this.instances.map(inst => ({ type: 'instance', data: inst }))
        });
        
        // Add current source markers for selected instances
        const selectedSources = window.irDropVisualizer ? window.irDropVisualizer.getSelectedSources() : new Map();
        
        if (selectedSources.size > 0) {
            const sourceX = [];
            const sourceY = [];
            const sourceTexts = [];
            
            selectedSources.forEach((currentValue, instanceId) => {
                const source = this.instances.find(i => i.id == instanceId);
                if (source) {
                    sourceX.push(source.col);
                    sourceY.push(source.row);
                    sourceTexts.push(`Current Source<br>Instance ${instanceId}<br>${currentValue}mA`);
                }
            });
            
            if (sourceX.length > 0) {
                traces.push({
                    x: sourceX,
                    y: sourceY,
                    mode: 'markers',
                    marker: {
                        color: 'green',
                        size: 16,
                        symbol: 'star',
                        line: { color: 'darkgreen', width: 2 }
                    },
                    name: 'Current Sources',
                    showlegend: true,
                    hovertext: sourceTexts,
                    hoverinfo: 'text'
                });
            }
        }
        
        // Fallback for old single source method (if still used)
        if (this.currentSource && selectedSources.size === 0) {
            const source = this.instances.find(i => i.id === this.currentSource);
            if (source) {
                traces.push({
                    x: [source.col],
                    y: [source.row],
                    mode: 'markers',
                    marker: {
                        color: 'green',
                        size: 16,
                        symbol: 'star',
                        line: { color: 'darkgreen', width: 2 }
                    },
                    name: 'Source',
                    showlegend: true,
                    hovertext: [`Current Source<br>${window.irDropVisualizer.getCurrentValue()}mA`],
                    hoverinfo: 'text'
                });
            }
        }
        
        // Add voltage annotations if enabled
        if (this.showVoltages && this.voltageMap) {
            this.addVoltageAnnotations();
        }
        
        Plotly.react(this.containerId, traces);
    }
    
    createHeatmapTrace() {
        const z = [];
        for (let row = 0; row < this.gridSize.rows; row++) {
            z[row] = [];
            for (let col = 0; col < this.gridSize.cols; col++) {
                z[row][col] = this.voltageMap[row][col] || 0;
            }
        }
        
        return {
            z: z,
            type: 'heatmap',
            colorscale: [
                [0, '#0066cc'],      // Low IR drop (blue)
                [0.5, '#ffcc00'],    // Medium IR drop (yellow)
                [1, '#ff3300']       // High IR drop (red)
            ],
            showscale: true,
            colorbar: {
                title: 'Voltage (V)',
                titlefont: { color: '#e0e5f0' },
                tickfont: { color: '#e0e5f0' }
            },
            hovertemplate: 'Row: %{y}<br>Col: %{x}<br>Voltage: %{z:.3f}V<extra></extra>',
            name: 'IR Drop Heatmap',
            showlegend: false
        };
    }
    
    addVoltageAnnotations() {
        const annotations = [];
        
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols; col++) {
                if (this.voltageMap[row][col] !== null) {
                    annotations.push({
                        x: col,
                        y: row,
                        text: `${this.voltageMap[row][col].toFixed(3)}V`,
                        showarrow: false,
                        font: { size: 8, color: '#e0e5f0' },
                        bgcolor: 'rgba(0,0,0,0.5)',
                        bordercolor: '#2a3352',
                        borderwidth: 1
                    });
                }
            }
        }
        
        Plotly.relayout(this.containerId, { annotations: annotations });
    }
    
    handlePlotClick(data) {
        if (data.points && data.points.length > 0) {
            const point = data.points[0];
            if (point.customdata) {
                const element = point.customdata;
                if (element.type === 'instance') {
                    this.selectInstance(element.data);
                } else if (element.type === 'bump') {
                    this.selectBump(element.data);
                }
            }
        }
    }
    
    selectInstance(instance) {
        this.selectCurrentSource(instance.id);
        
        // Update dropdown
        document.getElementById('currentSource').value = instance.id;
    }
    
    selectBump(bump) {
        // For IR drop visualizer, clicking on bumps doesn't do anything special
        // But we keep the method for consistency with SPR visualizer
    }
    
    selectCurrentSource(sourceId) {
        this.currentSource = sourceId;
        this.updatePlot();
    }
    
    updateSelectionDropdowns() {
        const currentSourceSelect = document.getElementById('currentSource');
        
        // Clear existing options
        currentSourceSelect.innerHTML = '<option value="">Select current source...</option>';
        
        // Add only instances to current source dropdown
        this.instances.forEach(instance => {
            const option = document.createElement('option');
            option.value = instance.id;
            option.textContent = `Instance ${instance.id}`;
            currentSourceSelect.appendChild(option);
        });
        
        // Add event listener for dropdown change
        currentSourceSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                const selected = this.instances.find(inst => inst.id === e.target.value);
                if (selected) {
                    this.selectCurrentSource(selected.id);
                }
            }
        });
    }
    
    simulateIRDrop() {
        if (!this.currentSource) {
            alert('Please select a current source first');
            return;
        }
        
        const currentValue = window.irDropVisualizer.getCurrentValue();
        const source = this.instances.find(i => i.id === this.currentSource);
        
        if (!source) {
            alert('Invalid current source selected');
            return;
        }
        
        // Calculate voltage distribution using nodal analysis
        this.voltageMap = this.calculateVoltageDistribution(source, currentValue);
        
        // Update visualization
        this.updatePlot();
        
        // Update results
        this.updateAnalysisResults(source, currentValue);
        
        // Mark simulation as active
        window.irDropVisualizer.setSimulationActive(true);
    }
    
    calculateVoltageDistribution(source, currentMa) {
        const voltages = [];
        const currentA = currentMa / 1000; // Convert to Amperes
        
        // Initialize voltage map
        for (let row = 0; row < this.gridSize.rows; row++) {
            voltages[row] = [];
            for (let col = 0; col < this.gridSize.cols; col++) {
                voltages[row][col] = 0;
            }
        }
        
        // Set source voltage (assume 1V supply)
        const sourceVoltage = 1.0;
        voltages[source.row][source.col] = sourceVoltage;
        
        // Simple voltage drop calculation using resistance network
        // This is a simplified model - in practice, you'd use nodal analysis
        const resistance = 0.1; // Average resistance between nodes
        
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols; col++) {
                if (row === source.row && col === source.col) continue;
                
                // Calculate Manhattan distance from source
                const distance = Math.abs(row - source.row) + Math.abs(col - source.col);
                
                // Calculate voltage drop based on distance and current
                const voltageDrop = currentA * resistance * distance;
                voltages[row][col] = Math.max(0, sourceVoltage - voltageDrop);
            }
        }
        
        return voltages;
    }
    
    updateAnalysisResults(source, currentMa) {
        if (!this.voltageMap) return;
        
        let maxIRDrop = 0;
        let minVoltage = 1.0;
        
        // Find max IR drop and min voltage
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols; col++) {
                const voltage = this.voltageMap[row][col];
                const irDrop = 1.0 - voltage;
                
                if (irDrop > maxIRDrop) maxIRDrop = irDrop;
                if (voltage < minVoltage) minVoltage = voltage;
            }
        }
        
        // Calculate approximate power loss
        const powerLoss = (currentMa / 1000) * maxIRDrop * 1000; // mW
        
        const results = {
            source: `Instance ${source.id}`,
            current: currentMa,
            maxIRDrop: (maxIRDrop * 1000).toFixed(1), // Convert to mV
            minVoltage: minVoltage.toFixed(3),
            powerLoss: powerLoss.toFixed(2)
        };
        
        window.irDropVisualizer.updateAnalysisResults(results);
    }
    
    clearSimulation() {
        this.voltageMap = null;
        this.currentFlowMap = null;
        this.currentSource = null;
        this.updatePlot();
        window.irDropVisualizer.setSimulationActive(false);
    }
    
    clearAnimations() {
        this.animationIntervals.forEach(interval => clearInterval(interval));
        this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this.animationIntervals = [];
        this.animationTimeouts = [];
    }
    
    toggleVoltageDisplay(show) {
        this.showVoltages = show;
        if (this.voltageMap) {
            this.updatePlot();
        }
    }
    
    toggleCurrentFlowDisplay(show) {
        this.showCurrentFlow = show;
        // Implementation depends on current flow visualization
    }
    
    resize() {
        Plotly.Plots.resize(this.containerId);
    }
    
    simulateMultiSourceIRDrop(selectedSources) {
        if (!selectedSources || selectedSources.size === 0) {
            alert('Please select at least one current source');
            return;
        }
        
        console.log('Simulating multi-source IR drop with sources:', Array.from(selectedSources.entries()));
        
        // Calculate voltage distribution with multiple sources
        this.voltageMap = this.calculateMultiSourceVoltageDistribution(selectedSources);
        
        // Update visualization
        this.updatePlot();
        
        // Update results
        this.updateMultiSourceAnalysisResults(selectedSources);
        
        // Mark simulation as active
        window.irDropVisualizer.setSimulationActive(true);
    }
    
    calculateMultiSourceVoltageDistribution(selectedSources) {
        const voltages = [];
        const sourceVoltage = 1.0;
        
        // Initialize voltage map
        for (let row = 0; row < this.gridSize.rows; row++) {
            voltages[row] = [];
            for (let col = 0; col < this.gridSize.cols; col++) {
                voltages[row][col] = sourceVoltage; // Start with supply voltage
            }
        }
        
        // Apply voltage drops from all current sources using superposition
        selectedSources.forEach((currentMa, instanceId) => {
            const source = this.instances.find(i => i.id == instanceId);
            if (!source) {
                console.warn(`Instance ${instanceId} not found`);
                return;
            }
            
            const currentA = currentMa / 1000; // Convert to Amperes
            const resistance = 0.1; // Average resistance between nodes
            
            // Calculate voltage drop contribution from this source
            for (let row = 0; row < this.gridSize.rows; row++) {
                for (let col = 0; col < this.gridSize.cols; col++) {
                    if (row === source.row && col === source.col) continue;
                    
                    // Calculate Manhattan distance from source
                    const distance = Math.abs(row - source.row) + Math.abs(col - source.col);
                    
                    // Calculate voltage drop based on distance and current
                    const voltageDrop = currentA * resistance * distance * 0.5; // Reduced for multiple sources
                    voltages[row][col] = Math.max(0, voltages[row][col] - voltageDrop);
                }
            }
        });
        
        return voltages;
    }
    
    updateMultiSourceAnalysisResults(selectedSources) {
        if (!this.voltageMap) return;
        
        let maxIRDrop = 0;
        let minVoltage = 1.0;
        let totalCurrent = 0;
        
        // Calculate total current from all sources
        selectedSources.forEach((currentMa) => {
            totalCurrent += currentMa;
        });
        
        // Find max IR drop and min voltage
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols; col++) {
                const voltage = this.voltageMap[row][col];
                const irDrop = 1.0 - voltage;
                
                if (irDrop > maxIRDrop) maxIRDrop = irDrop;
                if (voltage < minVoltage) minVoltage = voltage;
            }
        }
        
        // Calculate approximate total power loss
        const totalPowerLoss = (totalCurrent / 1000) * maxIRDrop * 1000; // mW
        
        // Create results object
        const results = {
            type: 'multi-source',
            activeSources: selectedSources.size,
            totalCurrent: totalCurrent,
            maxIRDrop: (maxIRDrop * 1000).toFixed(1), // Convert to mV
            minVoltage: minVoltage.toFixed(3),
            totalPowerLoss: totalPowerLoss.toFixed(2),
            sources: Array.from(selectedSources.entries()).map(([id, current]) => ({
                id: id,
                current: current
            }))
        };
        
        // Update the results display
        this.displayMultiSourceResults(results);
    }
    
    displayMultiSourceResults(results) {
        const resultsDiv = document.getElementById('analysisResults');
        if (!resultsDiv) return;
        
        let html = '<div class="multi-source-results">';
        
        // Summary section
        html += '<div class="results-summary">';
        html += '<h4>Multi-Source Analysis Summary</h4>';
        html += `<p><strong>Active Sources:</strong> ${results.activeSources}</p>`;
        html += `<p><strong>Total Current:</strong> ${results.totalCurrent}mA</p>`;
        html += `<p><strong>Max IR Drop:</strong> ${results.maxIRDrop}mV</p>`;
        html += `<p><strong>Min Voltage:</strong> ${results.minVoltage}V</p>`;
        html += `<p><strong>Total Power Loss:</strong> ${results.totalPowerLoss}mW</p>`;
        html += '</div>';
        
        // Individual sources section
        if (results.sources.length > 0) {
            html += '<div class="individual-sources">';
            html += '<h4>Individual Source Currents</h4>';
            results.sources.forEach(source => {
                html += `<p><strong>Instance ${source.id}:</strong> ${source.current}mA</p>`;
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        resultsDiv.innerHTML = html;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlotlyGridVisualizer;
}
