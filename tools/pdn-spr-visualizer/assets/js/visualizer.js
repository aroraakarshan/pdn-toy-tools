// Main Visualizer Application Controller

class PDNVisualizer {
    constructor() {
        this.grid = null;
        this.pathFinder = null;
        this.animationEngine = null;
        this.currentPaths = [];
        this.selectedSource = null;
        this.selectedTarget = null;
        this.showResistance = true;
        this.tooltip = null;
        
        this.initializeApp();
        this.setupEventListeners();
        this.generateInitialGrid();
    }
    
    initializeApp() {
        // Initialize Plotly grid visualizer
        window.plotlyGrid = new PlotlyGridVisualizer('pdnPlot');
        this.tooltip = document.getElementById('tooltipDisplay');
        this.setupTooltip();
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
        
        // Number of paths control
        document.getElementById('numPaths').addEventListener('input', (e) => {
            const numPaths = parseInt(e.target.value);
            document.getElementById('pathsValue').textContent = numPaths;
        });
        
        // Button events
        document.getElementById('generateNetwork').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.generateFixedGrid();
            }
        });
        
        document.getElementById('findPath').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.findShortestPath();
            }
        });
        
        document.getElementById('clearCanvas').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.clearCanvas();
            }
        });
        
        document.getElementById('animateAllPaths').addEventListener('click', () => {
            if (window.plotlyGrid) {
                window.plotlyGrid.showAllPaths();
            }
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetVisualization();
        });
        
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.showHelp();
        });
        
        // Checkbox events
        document.getElementById('showResistance').addEventListener('change', (e) => {
            this.showResistance = e.target.checked;
            this.redraw();
        });
        
        document.getElementById('segmentAnimation').addEventListener('change', (e) => {
            // Animation mode will be used in path animation
        });
        
        // Canvas events
        this.setupCanvasEvents();
        
        // Modal events
        this.setupModalEvents();
        
        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    setupCanvasEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
        
        this.canvas.addEventListener('click', (e) => {
            this.handleCanvasClick(e);
        });
    }
    
    setupModalEvents() {
        const modal = document.getElementById('helpModal');
        const closeBtn = document.querySelector('.modal-close');
        
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
    
    generateFixedNetwork() {
        // Create fixed 10x10 grid with 3 domains, 5 instances each
        this.grid = new PDNGrid(10, 10, 0.85);
        this.pathFinder = new AdvancedPathFinder(this.grid);
        
        // Initialize animation engine
        if (this.animationEngine) {
            this.animationEngine.stop();
        }
        this.animationEngine = new PDNAnimationEngine(this.canvas, this.grid);
        
        this.clearSelections();
        this.updateSelectors();
        this.redraw();
        this.updateStatus('Fixed network generated: 10×10 grid, 3 domains, 5 instances each');
    }
    
    updateSelectors() {
        const sourceSelect = document.getElementById('sourceSelect');
        const targetSelect = document.getElementById('targetSelect');
        
        // Clear existing options
        sourceSelect.innerHTML = '<option value="">Select source instance...</option>';
        targetSelect.innerHTML = '<option value="">Select target domain...</option>';
        
        // Add instance options for source
        this.grid.bumps.forEach((bump, index) => {
            const option = document.createElement('option');
            option.value = `${bump.row},${bump.col}`;
            option.textContent = `Domain ${bump.domainId} - Instance at (${bump.row}, ${bump.col})`;
            sourceSelect.appendChild(option);
        });
        
        // Add domain options for target
        this.grid.domains.forEach((domain, index) => {
            const option = document.createElement('option');
            option.value = `domain_${domain.id}`;
            option.textContent = `Domain ${domain.id} (${domain.bumps.length} instances)`;
            targetSelect.appendChild(option);
        });
        
        // Add event listeners
        sourceSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                const [row, col] = e.target.value.split(',').map(Number);
                this.selectedSource = { row, col };
            } else {
                this.selectedSource = null;
            }
            this.redraw();
        });
        
        targetSelect.addEventListener('change', (e) => {
            if (e.target.value && e.target.value.startsWith('domain_')) {
                const domainId = parseInt(e.target.value.split('_')[1]);
                this.selectedTarget = { domainId: domainId };
            } else {
                this.selectedTarget = null;
            }
            this.redraw();
        });
    }
    
    findShortestPath() {
        if (!this.selectedSource || !this.selectedTarget) {
            this.updateStatus('Please select both source instance and target domain', 'error');
            return;
        }
        
        if (this.selectedSource.domainId === this.selectedTarget.domainId) {
            this.updateStatus('Source and target cannot be in the same domain', 'error');
            return;
        }
        
        // Find path from source instance to virtual node of target domain
        const targetVirtualBump = this.grid.virtualBumps.find(vb => vb.domainId === this.selectedTarget.domainId);
        if (!targetVirtualBump) {
            this.updateStatus('Target domain virtual node not found', 'error');
            return;
        }
        
        const path = this.pathFinder.findOptimalPath(
            this.selectedSource, 
            { row: targetVirtualBump.row, col: targetVirtualBump.col, isVirtual: true }
        );
        
        if (!path) {
            this.updateStatus('No path found between selected points', 'error');
            this.updateResults(null);
            return;
        }
        
        // Modify path to end at a physical bump instead of virtual node
        const modifiedPath = this.modifyPathForVisualization(path, this.selectedTarget.domainId);
        
        this.currentPaths = [modifiedPath];
        this.updateResults(modifiedPath);
        
        // Animate the path
        const segmentMode = document.getElementById('segmentAnimation').checked;
        this.animationEngine.animatePath(modifiedPath, segmentMode ? 'segment' : 'complete');
        
        this.updateStatus('Shortest path found and animated');
    }
    
    modifyPathForVisualization(path, targetDomainId) {
        // Find the closest physical bump in the target domain to end the visual path
        const targetDomain = this.grid.domains.find(d => d.id === targetDomainId);
        if (!targetDomain || targetDomain.bumps.length === 0) return path;
        
        // Find the last non-virtual segment
        let lastPhysicalIndex = -1;
        for (let i = path.segments.length - 1; i >= 0; i--) {
            if (!path.segments[i].isVirtual) {
                lastPhysicalIndex = i;
                break;
            }
        }
        
        if (lastPhysicalIndex === -1) return path;
        
        // Find closest bump in target domain to the last physical point
        const lastPoint = path.segments[lastPhysicalIndex].to;
        let closestBump = targetDomain.bumps[0];
        let minDistance = Infinity;
        
        targetDomain.bumps.forEach(bump => {
            const node = this.grid.nodes[bump.row][bump.col];
            const distance = Math.sqrt(
                Math.pow(lastPoint.x - node.x, 2) + 
                Math.pow(lastPoint.y - node.y, 2)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestBump = bump;
            }
        });
        
        // Create modified path that ends at the closest bump
        const closestNode = this.grid.nodes[closestBump.row][closestBump.col];
        const modifiedSegments = path.segments.slice(0, lastPhysicalIndex + 1);
        
        // Add final segment to closest bump if not already there
        if (lastPoint.row !== closestBump.row || lastPoint.col !== closestBump.col) {
            modifiedSegments.push({
                from: lastPoint,
                to: { x: closestNode.x, y: closestNode.y, row: closestBump.row, col: closestBump.col },
                isVirtual: false,
                resistance: 0.01 // Virtual connection resistance
            });
        }
        
        return {
            ...path,
            segments: modifiedSegments,
            visualEndPoint: closestBump
        };
    }
    
    animateAllPaths() {
        if (!this.selectedSource || !this.selectedTarget) {
            this.updateStatus('Please select both source and target bumps', 'error');
            return;
        }
        
        const paths = this.pathFinder.findAlternativePaths(
            this.selectedSource, 
            this.selectedTarget, 
            5
        );
        
        if (paths.length === 0) {
            this.updateStatus('No paths found between selected bumps', 'error');
            return;
        }
        
        this.currentPaths = paths;
        this.animationEngine.animateMultiplePaths(paths);
        
        const stats = this.pathFinder.getPathStatistics(paths);
        this.updateMultiplePathResults(stats);
        
        this.updateStatus(`Found and animated ${paths.length} alternative paths`);
    }
    
    updateResults(path) {
        const resultsDiv = document.getElementById('pathResults');
        
        if (!path) {
            resultsDiv.innerHTML = '<p>No path found</p>';
            return;
        }
        
        const html = `
            <div class="result-item">
                <strong>Total Resistance:</strong>
                <span class="result-value">${PDNUtils.formatResistance(path.totalResistance)}</span>
            </div>
            <div class="result-item">
                <strong>Path Length:</strong>
                <span class="result-value">${path.nodeCount} nodes</span>
            </div>
            <div class="result-item">
                <strong>Path Type:</strong>
                <span class="result-value">${path.pathType}</span>
            </div>
            <div class="result-item">
                <strong>Segments:</strong>
                <span class="result-value">${path.segments.length}</span>
            </div>
        `;
        
        resultsDiv.innerHTML = html;
    }
    
    updateMultiplePathResults(stats) {
        const resultsDiv = document.getElementById('pathResults');
        
        if (!stats) {
            resultsDiv.innerHTML = '<p>No paths found</p>';
            return;
        }
        
        const html = `
            <div class="result-item">
                <strong>Paths Found:</strong>
                <span class="result-value">${stats.pathCount}</span>
            </div>
            <div class="result-item">
                <strong>Best Resistance:</strong>
                <span class="result-value">${PDNUtils.formatResistance(stats.minResistance)}</span>
            </div>
            <div class="result-item">
                <strong>Worst Resistance:</strong>
                <span class="result-value">${PDNUtils.formatResistance(stats.maxResistance)}</span>
            </div>
            <div class="result-item">
                <strong>Average Resistance:</strong>
                <span class="result-value">${PDNUtils.formatResistance(stats.avgResistance)}</span>
            </div>
        `;
        
        resultsDiv.innerHTML = html;
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const hoveredElement = this.getElementAtPosition(x, y);
        
        if (hoveredElement) {
            this.showTooltip(e.clientX, e.clientY, hoveredElement);
        } else {
            this.hideTooltip();
        }
    }
    
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedElement = this.getElementAtPosition(x, y);
        
        if (clickedElement && clickedElement.type === 'bump') {
            // Handle bump selection
            this.selectBump(clickedElement);
        }
    }
    
    getElementAtPosition(x, y) {
        if (!this.grid) return null;
        
        // Check bumps first
        for (const bump of this.grid.bumps) {
            const node = this.grid.nodes[bump.row][bump.col];
            const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
            
            if (distance <= 10) {
                return {
                    type: 'bump',
                    bump: bump,
                    node: node,
                    domain: this.grid.domains.find(d => d.id === bump.domainId)
                };
            }
        }
        
        // Check virtual bumps
        for (const vb of this.grid.virtualBumps) {
            const distance = Math.sqrt(Math.pow(x - vb.x, 2) + Math.pow(y - vb.y, 2));
            
            if (distance <= 15) {
                return {
                    type: 'virtualBump',
                    virtualBump: vb,
                    domain: this.grid.domains.find(d => d.id === vb.domainId)
                };
            }
        }
        
        // Check grid nodes
        for (let row = 0; row < this.grid.rows; row++) {
            for (let col = 0; col < this.grid.cols; col++) {
                const node = this.grid.nodes[row][col];
                if (!node.isActive) continue;
                
                const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
                
                if (distance <= 5) {
                    return {
                        type: 'node',
                        node: node,
                        row: row,
                        col: col
                    };
                }
            }
        }
        
        return null;
    }
    
    showTooltip(x, y, element) {
        let content = '';
        
        switch (element.type) {
            case 'bump':
                content = `
                    <strong>Bump (Domain ${element.domain.id})</strong><br>
                    Position: (${element.bump.row}, ${element.bump.col})<br>
                    Node Resistance: ${PDNUtils.formatResistance(element.node.resistance)}
                `;
                break;
            case 'virtualBump':
                content = `
                    <strong>Virtual Bump (Domain ${element.domain.id})</strong><br>
                    Connected Bumps: ${element.domain.bumps.length}<br>
                    Low Resistance: ${PDNUtils.formatResistance(element.domain.lowResistanceValue)}
                `;
                break;
            case 'node':
                content = `
                    <strong>Grid Node</strong><br>
                    Position: (${element.row}, ${element.col})<br>
                    Resistance: ${PDNUtils.formatResistance(element.node.resistance)}
                `;
                break;
        }
        
        this.tooltip.innerHTML = content;
        this.tooltip.style.left = (x + 10) + 'px';
        this.tooltip.style.top = (y - 10) + 'px';
        this.tooltip.classList.add('visible');
    }
    
    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }
    
    selectBump(element) {
        const bumpValue = `${element.bump.row},${element.bump.col}`;
        
        // Update selectors
        if (!this.selectedSource) {
            document.getElementById('sourceSelect').value = bumpValue;
            this.selectedSource = { row: element.bump.row, col: element.bump.col };
        } else if (!this.selectedTarget) {
            document.getElementById('targetSelect').value = bumpValue;
            this.selectedTarget = { row: element.bump.row, col: element.bump.col };
        } else {
            // Replace source
            document.getElementById('sourceSelect').value = bumpValue;
            this.selectedSource = { row: element.bump.row, col: element.bump.col };
        }
        
        this.redraw();
    }
    
    setupTooltip() {
        // Tooltip is already in HTML, just need to initialize
    }
    
    redraw() {
        if (this.animationEngine && !this.animationEngine.isRunning) {
            this.animationEngine.render();
        }
    }
    
    resizeCanvas() {
        if (this.animationEngine) {
            this.animationEngine.setupCanvas();
            this.redraw();
        }
    }
    
    clearSelections() {
        this.selectedSource = null;
        this.selectedTarget = null;
        this.currentPaths = [];
        
        document.getElementById('sourceSelect').value = '';
        document.getElementById('targetSelect').value = '';
        
        this.updateResults(null);
    }
    
    resetVisualization() {
        if (this.animationEngine) {
            this.animationEngine.stop();
        }
        
        this.clearSelections();
        
        // Reset controls to default values
        document.getElementById('gridRows').value = 10;
        document.getElementById('gridCols').value = 10;
        document.getElementById('networkDensity').value = 75;
        document.getElementById('numDomains').value = 3;
        document.getElementById('bumpsPerDomain').value = 4;
        document.getElementById('animationSpeed').value = 1;
        
        // Update displays
        document.getElementById('rowsValue').textContent = '10';
        document.getElementById('colsValue').textContent = '10';
        document.getElementById('densityValue').textContent = '75%';
        document.getElementById('domainsValue').textContent = '3';
        document.getElementById('bumpsValue').textContent = '4';
        document.getElementById('speedValue').textContent = '1x';
        
        this.generateGrid();
        this.updateStatus('Visualization reset to default settings');
    }
    
    showHelp() {
        document.getElementById('helpModal').classList.add('active');
    }
    
    updateStatus(message, type = 'info') {
        // Could add a status bar or use console for now
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
    
    generateInitialGrid() {
        // Generate initial fixed network for demo
        setTimeout(() => {
            if (window.plotlyGrid) {
                window.plotlyGrid.generateFixedGrid();
            }
        }, 100);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.pdnVisualizer = new PDNVisualizer();
});
