// Plotly-based Grid Visualization for PDN SPR

class PlotlyGridVisualizer {
    constructor(containerId) {
        this.containerId = containerId;
        this.grid = null;
        this.gridSize = { rows: 10, cols: 10 };
        this.domains = [];
        this.instances = [];
        this.currentPath = null;
        this.selectedSource = null;
        this.selectedTarget = null;
        
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
        this.currentPath = null;
        
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
        
        // Generate 3 domains with random number of bumps each
        const colors = ['#FF6B6B', '#FFA500', '#4CAF50'];
        const domainNames = ['Domain A', 'Domain B', 'Domain C'];
        
        // Track occupied grid positions to prevent overlapping
        const occupiedPositions = new Set();
        
        for (let d = 0; d < 3; d++) {
            const domain = {
                id: d,
                name: domainNames[d],
                color: colors[d],
                bumps: []
            };
            
            // Generate random number of bumps for this domain (2-6 bumps)
            const numBumps = 2 + Math.floor(Math.random() * 5);
            for (let b = 0; b < numBumps; b++) {
                const position = this.getAvailablePosition(occupiedPositions);
                if (position) {
                    const bump = {
                        id: `bump-${d}-${b}`,
                        domainId: d,
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
                id: `virtual-${d}`,
                domainId: d,
                row: -1, // Virtual position
                col: -1,
                resistance: 0.001, // Very low resistance (1mΩ)
                type: 'virtual'
            };
            
            this.domains.push(domain);
        }
        
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
        this.updateSelectionDropdowns();
    }
    
    getAvailablePosition(occupiedPositions) {
        // Try to find an available position on the grid
        // Try random positions first, then do a systematic search if needed
        const maxAttempts = 50; // Random attempts
        
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
        
        // Grid is full
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
        
        traces.push({
            x: gridX,
            y: gridY,
            mode: 'lines',
            line: { color: '#ddd', width: 1 },
            name: 'Grid Network',
            showlegend: true,
            hoverinfo: 'skip'
        });
        
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
        
        // Add current path if exists
        if (this.currentPath && this.currentPath.length > 1) {
            const pathX = this.currentPath.map(point => point.col);
            const pathY = this.currentPath.map(point => point.row);
            
            traces.push({
                x: pathX,
                y: pathY,
                mode: 'lines+markers',
                line: { color: '#FF4444', width: 4 },
                marker: { color: '#FF4444', size: 8 },
                name: 'Current Path',
                showlegend: true
            });
        }
        
        // Highlight selected source
        if (this.selectedSource) {
            traces.push({
                x: [this.selectedSource.col],
                y: [this.selectedSource.row],
                mode: 'markers',
                marker: {
                    color: 'green',
                    size: 16,
                    symbol: 'star',
                    line: { color: 'darkgreen', width: 2 }
                },
                name: 'Source',
                showlegend: true
            });
        }
        
        // Update the plot
        Plotly.react(this.containerId, traces);
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
        if (!this.selectedSource) {
            this.selectedSource = instance;
            document.getElementById('sourceSelect').value = instance.id;
        } else if (!this.selectedTarget) {
            this.selectedTarget = instance;
            document.getElementById('targetSelect').value = instance.id;
        } else {
            // Replace source
            this.selectedSource = instance;
            document.getElementById('sourceSelect').value = instance.id;
        }
        
        this.updatePlot();
    }
    
    selectBump(bump) {
        if (!this.selectedSource) {
            this.selectedSource = bump;
            document.getElementById('sourceSelect').value = bump.id;
        } else {
            // Replace source
            this.selectedSource = bump;
            document.getElementById('sourceSelect').value = bump.id;
        }
        
        this.updatePlot();
    }
    
    updateSelectionDropdowns() {
        const sourceSelect = document.getElementById('sourceSelect');
        const targetSelect = document.getElementById('targetSelect');
        
        // Clear existing options
        sourceSelect.innerHTML = '<option value="">Select source instance...</option>';
        targetSelect.innerHTML = '<option value="">Select target domain...</option>';
        
        // Add only instances to source dropdown
        this.instances.forEach(instance => {
            const sourceOption = document.createElement('option');
            sourceOption.value = instance.id;
            sourceOption.textContent = `Instance ${instance.id}`;
            sourceSelect.appendChild(sourceOption);
        });
        
        // Add only domains to target dropdown
        this.domains.forEach(domain => {
            const targetOption = document.createElement('option');
            targetOption.value = domain.id;
            targetOption.textContent = domain.name;
            targetSelect.appendChild(targetOption);
        });
        
        // Add event listeners for dropdown changes
        sourceSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                const selected = this.instances.find(inst => inst.id === e.target.value);
                if (selected) {
                    this.selectedSource = selected;
                    this.updatePlot();
                }
            }
        });
        
        targetSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                const selected = this.domains.find(domain => domain.id == e.target.value);
                if (selected) {
                    this.selectedTarget = selected;
                    this.updatePlot();
                }
            }
        });
    }
    
    findShortestPath() {
        if (!this.selectedSource || !this.selectedTarget) {
            this.showStatus('Please select both source and target');
            return;
        }
        
        if (this.selectedSource.id === this.selectedTarget.id) {
            this.showStatus('Source and target cannot be the same');
            return;
        }
        
        // Implement Dijkstra's algorithm for shortest resistance path
        const result = this.dijkstraSPR(this.selectedSource, this.selectedTarget);
        
        if (!result) {
            this.showStatus('No path found');
            return;
        }
        
        // Animate the single path
        this.animateSinglePathFinding(result);
        this.showPathResults(result.totalResistance);
    }
    
    animateSinglePathFinding(result) {
        // Start with base plot
        this.updatePlot();
        
        // Animate particle moving along the path with smooth interpolation
        let currentSegment = 0;
        let segmentProgress = 0;
        let accumulatedResistance = this.selectedSource.resistance;
        
        const animateParticle = () => {
            if (currentSegment >= result.path.length - 1) {
                // Animation complete - show final path and final resistance
                this.currentPath = result.path;
                this.updatePlot();
                this.showPathResults(result.totalResistance);
                return;
            }
            
            // Get current and next points
            const currentPoint = result.path[currentSegment];
            const nextPoint = result.path[currentSegment + 1];
            
            // Smooth interpolation between points
            const particleX = currentPoint.col + (nextPoint.col - currentPoint.col) * segmentProgress;
            const particleY = currentPoint.row + (nextPoint.row - currentPoint.row) * segmentProgress;
            
            // Build path trace up to current position
            const completedPath = result.path.slice(0, currentSegment + 1);
            if (segmentProgress > 0) {
                // Add intermediate point for smooth trace
                completedPath.push({ col: particleX, row: particleY });
            }
            
            // Update current path for trace visualization
            this.currentPath = completedPath;
            this.updatePlot();
            
            // Add moving particle
            this.addMovingParticle(particleX, particleY);
            
            // Update resistance display as we complete each segment
            if (segmentProgress === 0 && currentSegment > 0) {
                // Calculate resistance of the segment we just completed
                const segmentResistance = this.getSegmentResistance(
                    result.path[currentSegment - 1], 
                    result.path[currentSegment]
                );
                accumulatedResistance += segmentResistance;
                this.showProgressivePathResults(accumulatedResistance, currentSegment + 1, result.path.length, segmentResistance);
            }
            
            // Advance animation
            segmentProgress += 0.15; // Faster movement step (increased from 0.1)
            
            if (segmentProgress >= 1) {
                segmentProgress = 0;
                currentSegment++;
                
                // Update resistance when completing a segment
                if (currentSegment < result.path.length) {
                    const segmentResistance = this.getSegmentResistance(
                        result.path[currentSegment - 1], 
                        result.path[currentSegment]
                    );
                    accumulatedResistance += segmentResistance;
                    this.showProgressivePathResults(accumulatedResistance, currentSegment + 1, result.path.length, segmentResistance);
                }
            }
            
            const timeout = setTimeout(animateParticle, 40); // Faster interval (reduced from 60ms)
            this.animationTimeouts.push(timeout);
        };
        
        // Start animation
        this.currentPath = [result.path[0]]; // Start with just the source point
        this.showProgressivePathResults(accumulatedResistance, 1, result.path.length);
        const timeout = setTimeout(animateParticle, 100);
        this.animationTimeouts.push(timeout);
    }
    
    addMovingParticle(x, y) {
        // Add or update moving particle trace
        const particleTrace = {
            x: [x],
            y: [y],
            mode: 'markers',
            marker: {
                color: '#FFD700',
                size: 14,
                symbol: 'circle',
                line: { color: '#FFA500', width: 2 }
            },
            name: 'Moving Particle',
            showlegend: false,
            hoverinfo: 'skip'
        };
        
        try {
            // Check if particle trace already exists
            const plotDiv = document.getElementById(this.containerId);
            const existingTraces = plotDiv.data || [];
            const particleTraceIndex = existingTraces.findIndex(trace => trace.name === 'Moving Particle');
            
            if (particleTraceIndex >= 0) {
                Plotly.restyle(this.containerId, {
                    x: [[x]],
                    y: [[y]]
                }, particleTraceIndex);
            } else {
                Plotly.addTraces(this.containerId, particleTrace);
            }
        } catch (e) {
            console.log('Particle animation error:', e);
        }
    }
    
    getSegmentResistance(point1, point2) {
        const rowDiff = point2.row - point1.row;
        const colDiff = point2.col - point1.col;
        
        // Determine direction and get resistance
        if (rowDiff === 0 && colDiff === 1) {
            // Moving right
            return this.gridResistances[point1.row][point1.col].right || 0;
        } else if (rowDiff === 0 && colDiff === -1) {
            // Moving left
            return this.gridResistances[point1.row][point2.col].right || 0;
        } else if (rowDiff === 1 && colDiff === 0) {
            // Moving down
            return this.gridResistances[point1.row][point1.col].down || 0;
        } else if (rowDiff === -1 && colDiff === 0) {
            // Moving up
            return this.gridResistances[point2.row][point1.col].down || 0;
        }
        
        return 0; // No valid segment
    }
    
    showProgressivePathResults(currentResistance, currentSegment, totalSegments, segmentResistance = null) {
        const current = 3.3 / currentResistance;
        const resultsDiv = document.getElementById('pathResults');
        
        // Calculate visible segments (exclude virtual connection to bump)
        const visibleTotalSegments = totalSegments - 1; // Exclude virtual connection
        
        let segmentInfo = '';
        if (segmentResistance !== null) {
            segmentInfo = `
                <div class="result-item">
                    <strong>Current Segment Resistance:</strong> ${segmentResistance.toFixed(3)} Ω
                </div>
            `;
        }
        
        resultsDiv.innerHTML = `
            <div class="result-item">
                <strong>Progress:</strong> ${currentSegment}/${visibleTotalSegments} segments
            </div>
            <div class="result-item">
                <strong>Total Resistance:</strong> ${currentResistance.toFixed(3)} Ω
            </div>
            ${segmentInfo}
            <div class="result-item">
                <strong>Current:</strong> ${current.toFixed(3)} A
            </div>
        `;
    }
    
    dijkstraSPR(sourceInstance, targetDomain) {
        // Create node representation: each grid point plus domain virtual nodes
        const nodes = new Map();
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        
        // Add all grid points as nodes
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols; col++) {
                const nodeId = `${row},${col}`;
                nodes.set(nodeId, { row, col, type: 'grid' });
                distances.set(nodeId, Infinity);
                unvisited.add(nodeId);
            }
        }
        
        // Add virtual node for target domain
        const virtualNodeId = `virtual-${targetDomain.id}`;
        nodes.set(virtualNodeId, targetDomain.virtualNode);
        distances.set(virtualNodeId, Infinity);
        unvisited.add(virtualNodeId);
        
        // Set source distance to its own resistance
        const sourceNodeId = `${sourceInstance.row},${sourceInstance.col}`;
        distances.set(sourceNodeId, sourceInstance.resistance);
        
        while (unvisited.size > 0) {
            // Find unvisited node with minimum distance
            let currentNode = null;
            let minDistance = Infinity;
            for (const nodeId of unvisited) {
                if (distances.get(nodeId) < minDistance) {
                    minDistance = distances.get(nodeId);
                    currentNode = nodeId;
                }
            }
            
            if (currentNode === null || minDistance === Infinity) break;
            
            unvisited.delete(currentNode);
            
            // If we reached the virtual node, we found the shortest path
            if (currentNode === virtualNodeId) {
                break;
            }
            
            const current = nodes.get(currentNode);
            
            // Get neighbors and their resistances
            const neighbors = this.getNeighbors(current, targetDomain, sourceInstance);
            
            for (const neighbor of neighbors) {
                const neighborId = neighbor.id;
                if (!unvisited.has(neighborId)) continue;
                
                const edgeResistance = neighbor.resistance;
                const alt = distances.get(currentNode) + edgeResistance;
                
                if (alt < distances.get(neighborId)) {
                    distances.set(neighborId, alt);
                    previous.set(neighborId, currentNode);
                }
            }
        }
        
        // Reconstruct path
        const path = [];
        let currentNodeId = virtualNodeId;
        
        while (currentNodeId && previous.has(currentNodeId)) {
            const node = nodes.get(currentNodeId);
            if (node.type === 'grid') {
                path.unshift({ row: node.row, col: node.col });
            }
            currentNodeId = previous.get(currentNodeId);
        }
        
        // Add source to path
        path.unshift({ row: sourceInstance.row, col: sourceInstance.col });
        
        // For visualization, end at closest bump instead of virtual node
        const closestBump = this.findClosestBump(targetDomain, path[path.length - 1]);
        if (closestBump) {
            path.push({ row: closestBump.row, col: closestBump.col });
        }
        
        return {
            path: path,
            totalResistance: distances.get(virtualNodeId)
        };
    }
    
    isPositionOccupied(row, col, sourceInstance, targetDomain) {
        // Check if this position has any bump from any domain (except target domain bumps)
        for (const domain of this.domains) {
            if (domain.id !== targetDomain.id) {
                for (const bump of domain.bumps) {
                    if (bump.row === row && bump.col === col) {
                        return true; // Position occupied by non-target domain bump
                    }
                }
            }
        }
        
        // Check if this position has any instance (except source instance)
        for (const instance of this.instances) {
            if (instance.id !== sourceInstance.id && 
                instance.row === row && instance.col === col) {
                return true; // Position occupied by another instance
            }
        }
        
        return false; // Position is free
    }
    
    getNeighbors(currentNode, targetDomain, sourceInstance) {
        const neighbors = [];
        const { row, col } = currentNode;
        
        // Grid neighbors (4-directional)
        const directions = [
            { dr: 0, dc: 1, dir: 'right' },  // right
            { dr: 0, dc: -1, dir: 'left' },  // left
            { dr: 1, dc: 0, dir: 'down' },   // down
            { dr: -1, dc: 0, dir: 'up' }     // up
        ];
        
        for (const { dr, dc, dir } of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            
            if (newRow >= 0 && newRow < this.gridSize.rows && 
                newCol >= 0 && newCol < this.gridSize.cols) {
                
                // Check if the target position is occupied by any element
                if (this.isPositionOccupied(newRow, newCol, sourceInstance, targetDomain)) {
                    continue; // Skip this neighbor if position is occupied
                }
                
                let segmentResistance;
                
                // Get actual segment resistance from grid
                if (dir === 'right' && this.gridResistances[row][col].right !== null) {
                    segmentResistance = this.gridResistances[row][col].right;
                } else if (dir === 'left' && this.gridResistances[row][newCol].right !== null) {
                    segmentResistance = this.gridResistances[row][newCol].right;
                } else if (dir === 'down' && this.gridResistances[row][col].down !== null) {
                    segmentResistance = this.gridResistances[row][col].down;
                } else if (dir === 'up' && this.gridResistances[newRow][col].down !== null) {
                    segmentResistance = this.gridResistances[newRow][col].down;
                } else {
                    continue; // No valid connection
                }
                
                neighbors.push({
                    id: `${newRow},${newCol}`,
                    resistance: segmentResistance
                });
            }
        }
        
        // Check if current position has any bump from target domain
        for (const bump of targetDomain.bumps) {
            if (bump.row === row && bump.col === col) {
                // Add connection to virtual node with bump's low resistance
                neighbors.push({
                    id: `virtual-${targetDomain.id}`,
                    resistance: bump.resistance
                });
                break;
            }
        }
        
        return neighbors;
    }
    
    findClosestBump(domain, lastGridPoint) {
        let closestBump = null;
        let minDistance = Infinity;
        
        for (const bump of domain.bumps) {
            const distance = Math.abs(bump.row - lastGridPoint.row) + 
                           Math.abs(bump.col - lastGridPoint.col);
            if (distance < minDistance) {
                minDistance = distance;
                closestBump = bump;
            }
        }
        
        return closestBump;
    }
    
    showPathResults(resistance) {
        const current = 3.3 / resistance; // Assuming 3.3V supply
        const resultsDiv = document.getElementById('pathResults');
        
        // Calculate visible segments (exclude virtual connection to bump)
        const visibleSegments = this.currentPath.length - 2; // Exclude source and virtual connection
        
        resultsDiv.innerHTML = `
            <div class="result-item">
                <strong>Total Resistance:</strong> ${resistance.toFixed(3)} Ω
            </div>
            <div class="result-item">
                <strong>Current:</strong> ${current.toFixed(3)} A
            </div>
            <div class="result-item">
                <strong>Path Length:</strong> ${visibleSegments} segments
            </div>
        `;
    }
    
    showStatus(message) {
        console.log(message);
        // Could show in a status bar if needed
    }
    
    clearSelections() {
        this.selectedSource = null;
        this.selectedTarget = null;
        this.currentPath = null;
        document.getElementById('sourceSelect').value = '';
        document.getElementById('targetSelect').value = '';
        this.updatePlot();
    }
    
    clearCanvas() {
        // Stop any ongoing animations
        this.stopAllAnimations();
        
        this.selectedSource = null;
        this.selectedTarget = null;
        this.currentPath = null;
        document.getElementById('sourceSelect').value = '';
        document.getElementById('targetSelect').value = '';
        const resultsDiv = document.getElementById('pathResults');
        resultsDiv.innerHTML = '<p>Select source and target to see path analysis</p>';
        this.updatePlot();
    }
    
    stopAllAnimations() {
        // Clear any ongoing timeouts/intervals
        if (this.animationTimeouts) {
            this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
            this.animationTimeouts = [];
        }
        
        if (this.animationIntervals) {
            this.animationIntervals.forEach(interval => clearInterval(interval));
            this.animationIntervals = [];
        }
        
        // Reset animation state
        this.animationTimeouts = [];
        this.animationIntervals = [];
    }
    
    clearPathTraces() {
        try {
            const plotDiv = document.getElementById(this.containerId);
            const existingTraces = plotDiv.data || [];
            
            // Find and remove path traces and particle traces
            const tracesToDelete = [];
            existingTraces.forEach((trace, index) => {
                if (trace.name && (
                    trace.name.startsWith('Path ') || 
                    trace.name.startsWith('Moving Particle') ||
                    trace.name.includes('Flowing Particles')
                )) {
                    tracesToDelete.push(index);
                }
            });
            
            // Delete traces in reverse order to maintain indices
            if (tracesToDelete.length > 0) {
                Plotly.deleteTraces(this.containerId, tracesToDelete.reverse());
            }
        } catch (e) {
            console.log('Error clearing path traces:', e);
        }
    }
    
    showAllPaths() {
        if (!this.selectedSource || !this.selectedTarget) {
            this.showStatus('Please select both source and target');
            return;
        }
        
        const numPaths = parseInt(document.getElementById('numPaths').value);
        const allPaths = this.findMultiplePaths(this.selectedSource, this.selectedTarget, numPaths);
        
        if (!allPaths || allPaths.length === 0) {
            this.showStatus('No paths found');
            return;
        }
        
        // Start animated visualization
        this.animateMultiplePaths(allPaths);
        this.showMultiplePathResults(allPaths);
    }
    
    findMultiplePaths(sourceInstance, targetDomain, numPaths) {
        const paths = [];
        
        // Find the best path first
        const bestPath = this.dijkstraSPR(sourceInstance, targetDomain);
        if (bestPath) {
            paths.push(bestPath);
        }
        
        // Find alternative paths by temporarily blocking nodes from the best path
        for (let i = 1; i < numPaths && paths.length < numPaths; i++) {
            const blockedNodes = new Set();
            
            // Block some nodes from previous paths to force different routes
            for (const prevPath of paths) {
                const pathNodes = prevPath.path.slice(1, -1); // Exclude start and end
                const nodesToBlock = Math.min(2, pathNodes.length);
                for (let j = 0; j < nodesToBlock; j++) {
                    const nodeIndex = Math.floor(Math.random() * pathNodes.length);
                    const node = pathNodes[nodeIndex];
                    blockedNodes.add(`${node.row},${node.col}`);
                }
            }
            
            const altPath = this.dijkstraSPRWithBlocked(sourceInstance, targetDomain, blockedNodes);
            if (altPath && !this.isPathTooSimilar(altPath, paths)) {
                paths.push(altPath);
            }
        }
        
        return paths;
    }
    
    dijkstraSPRWithBlocked(sourceInstance, targetDomain, blockedNodes) {
        // Similar to dijkstraSPR but with blocked nodes
        const nodes = new Map();
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        
        // Add all grid points as nodes (except blocked ones)
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols; col++) {
                const nodeId = `${row},${col}`;
                if (!blockedNodes.has(nodeId)) {
                    nodes.set(nodeId, { row, col, type: 'grid' });
                    distances.set(nodeId, Infinity);
                    unvisited.add(nodeId);
                }
            }
        }
        
        // Add virtual node for target domain
        const virtualNodeId = `virtual-${targetDomain.id}`;
        nodes.set(virtualNodeId, targetDomain.virtualNode);
        distances.set(virtualNodeId, Infinity);
        unvisited.add(virtualNodeId);
        
        // Set source distance to its own resistance
        const sourceNodeId = `${sourceInstance.row},${sourceInstance.col}`;
        if (!nodes.has(sourceNodeId)) return null; // Source is blocked
        
        distances.set(sourceNodeId, sourceInstance.resistance);
        
        while (unvisited.size > 0) {
            let currentNode = null;
            let minDistance = Infinity;
            for (const nodeId of unvisited) {
                if (distances.get(nodeId) < minDistance) {
                    minDistance = distances.get(nodeId);
                    currentNode = nodeId;
                }
            }
            
            if (currentNode === null || minDistance === Infinity) break;
            
            unvisited.delete(currentNode);
            
            if (currentNode === virtualNodeId) break;
            
            const current = nodes.get(currentNode);
            const neighbors = this.getNeighbors(current, targetDomain, sourceInstance);
            
            for (const neighbor of neighbors) {
                const neighborId = neighbor.id;
                if (!unvisited.has(neighborId)) continue;
                
                const edgeResistance = neighbor.resistance;
                const alt = distances.get(currentNode) + edgeResistance;
                
                if (alt < distances.get(neighborId)) {
                    distances.set(neighborId, alt);
                    previous.set(neighborId, currentNode);
                }
            }
        }
        
        // Reconstruct path
        const path = [];
        let currentNodeId = virtualNodeId;
        
        while (currentNodeId && previous.has(currentNodeId)) {
            const node = nodes.get(currentNodeId);
            if (node.type === 'grid') {
                path.unshift({ row: node.row, col: node.col });
            }
            currentNodeId = previous.get(currentNodeId);
        }
        
        path.unshift({ row: sourceInstance.row, col: sourceInstance.col });
        
        const closestBump = this.findClosestBump(targetDomain, path[path.length - 1]);
        if (closestBump) {
            path.push({ row: closestBump.row, col: closestBump.col });
        }
        
        return {
            path: path,
            totalResistance: distances.get(virtualNodeId)
        };
    }
    
    isPathTooSimilar(newPath, existingPaths) {
        for (const existingPath of existingPaths) {
            let commonNodes = 0;
            const existingSet = new Set(existingPath.path.map(p => `${p.row},${p.col}`));
            
            for (const point of newPath.path) {
                if (existingSet.has(`${point.row},${point.col}`)) {
                    commonNodes++;
                }
            }
            
            const similarity = commonNodes / Math.max(newPath.path.length, existingPath.path.length);
            if (similarity > 0.7) return true; // Too similar
        }
        return false;
    }
    
    visualizeMultiplePaths(allPaths) {
        const traces = [];
        
        // Add grid network connections
        const gridX = [];
        const gridY = [];
        
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols - 1; col++) {
                gridX.push(col, col + 1, null);
                gridY.push(row, row, null);
            }
        }
        
        for (let col = 0; col < this.gridSize.cols; col++) {
            for (let row = 0; row < this.gridSize.rows - 1; row++) {
                gridX.push(col, col, null);
                gridY.push(row, row + 1, null);
            }
        }
        
        traces.push({
            x: gridX,
            y: gridY,
            mode: 'lines',
            line: { color: '#ddd', width: 1 },
            name: 'Grid Network',
            showlegend: true,
            hoverinfo: 'skip'
        });
        
        // Add domain bumps and instances (same as updatePlot)
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
        
        // Add multiple paths with different colors
        const pathColors = ['#FF4444', '#44FF44', '#4444FF', '#FFFF44', '#FF44FF', '#44FFFF', '#FFA500', '#800080'];
        
        allPaths.forEach((pathData, index) => {
            const pathX = pathData.path.map(point => point.col);
            const pathY = pathData.path.map(point => point.row);
            const color = pathColors[index % pathColors.length];
            
            traces.push({
                x: pathX,
                y: pathY,
                mode: 'lines+markers',
                line: { color: color, width: 3 },
                marker: { color: color, size: 6 },
                name: `Path ${index + 1} (${pathData.totalResistance.toFixed(3)}Ω)`,
                showlegend: true
            });
        });
        
        // Highlight selected source and target
        if (this.selectedSource) {
            traces.push({
                x: [this.selectedSource.col],
                y: [this.selectedSource.row],
                mode: 'markers',
                marker: {
                    color: 'green',
                    size: 16,
                    symbol: 'star',
                    line: { color: 'darkgreen', width: 2 }
                },
                name: 'Source',
                showlegend: true
            });
        }
        
        if (this.selectedTarget) {
            traces.push({
                x: [this.selectedTarget.col],
                y: [this.selectedTarget.row],
                mode: 'markers',
                marker: {
                    color: 'orange',
                    size: 16,
                    symbol: 'diamond',
                    line: { color: 'darkorange', width: 2 }
                },
                name: 'Target',
                showlegend: true
            });
        }
        
        Plotly.react(this.containerId, traces);
    }
    
    animateMultiplePaths(allPaths) {
        // Start with base plot that includes grid, domains, instances, source and target
        this.updatePlot();
        
        // Stop any ongoing animations and clear path traces
        this.stopAllAnimations();
        this.clearPathTraces();
        
        // Animate paths one by one with delays (exactly like single path)
        allPaths.forEach((pathData, index) => {
            const timeout = setTimeout(() => {
                this.animateSinglePath(pathData, index, allPaths.length);
            }, index * 800); // 800ms delay between each path
            this.animationTimeouts.push(timeout);
        });
    }
    
    animateSinglePath(pathData, pathIndex, totalPaths) {
        const pathColors = ['#FF4444', '#44FF44', '#4444FF', '#FFFF44', '#FF44FF', '#44FFFF', '#FFA500', '#800080'];
        const color = pathColors[pathIndex % pathColors.length];
        
        // Add empty path trace first and get its actual index
        this.addEmptyPathTrace(pathData, pathIndex, color);
        
        // Get the actual trace index after adding the trace
        let pathTraceIndex;
        try {
            const plotDiv = document.getElementById(this.containerId);
            const existingTraces = plotDiv.data || [];
            pathTraceIndex = existingTraces.findIndex(trace => 
                trace.name === `Path ${pathIndex + 1} (${pathData.totalResistance.toFixed(3)}Ω)`
            );
            // If not found, use fallback calculation
            if (pathTraceIndex === -1) {
                pathTraceIndex = this.getPathTraceIndex(pathIndex);
            }
        } catch (e) {
            pathTraceIndex = this.getPathTraceIndex(pathIndex);
        }
        
        // Animate particle moving along the path with smooth interpolation (same as single path)
        let currentSegment = 0;
        let segmentProgress = 0;
        let accumulatedResistance = this.selectedSource.resistance;
        
        const animateParticle = () => {
            if (currentSegment >= pathData.path.length - 1) {
                // Animation complete - show final path
                const pathX = pathData.path.map(point => point.col);
                const pathY = pathData.path.map(point => point.row);
                
                if (pathTraceIndex >= 0) {
                    try {
                        Plotly.restyle(this.containerId, {
                            x: [pathX],
                            y: [pathY]
                        }, pathTraceIndex);
                    } catch (e) {
                        console.log('Final path update error:', e);
                    }
                }
                return;
            }
            
            // Get current and next points
            const currentPoint = pathData.path[currentSegment];
            const nextPoint = pathData.path[currentSegment + 1];
            
            // Smooth interpolation between points
            const particleX = currentPoint.col + (nextPoint.col - currentPoint.col) * segmentProgress;
            const particleY = currentPoint.row + (nextPoint.row - currentPoint.row) * segmentProgress;
            
            // Build path trace up to current position
            const completedPath = pathData.path.slice(0, currentSegment + 1);
            if (segmentProgress > 0) {
                // Add intermediate point for smooth trace
                completedPath.push({ col: particleX, row: particleY });
            }
            
            // Update only this specific path trace
            const pathX = completedPath.map(point => point.col);
            const pathY = completedPath.map(point => point.row);
            
            if (pathTraceIndex >= 0) {
                try {
                    Plotly.restyle(this.containerId, {
                        x: [pathX],
                        y: [pathY]
                    }, pathTraceIndex);
                } catch (e) {
                    console.log('Path update error:', e);
                }
            }
            
            // Add moving particle
            this.addMultiPathParticle(particleX, particleY, color, pathIndex);
            
            // Update resistance display as we complete each segment
            if (segmentProgress === 0 && currentSegment > 0) {
                // Calculate resistance of the segment we just completed
                const segmentResistance = this.getSegmentResistance(
                    pathData.path[currentSegment - 1], 
                    pathData.path[currentSegment]
                );
                accumulatedResistance += segmentResistance;
                this.showProgressivePathResults(accumulatedResistance, currentSegment + 1, pathData.path.length, segmentResistance);
            }
            
            // Advance animation
            segmentProgress += 0.15;
            
            if (segmentProgress >= 1) {
                segmentProgress = 0;
                currentSegment++;
                
                // Update resistance when completing a segment
                if (currentSegment < pathData.path.length) {
                    const segmentResistance = this.getSegmentResistance(
                        pathData.path[currentSegment - 1], 
                        pathData.path[currentSegment]
                    );
                    accumulatedResistance += segmentResistance;
                    this.showProgressivePathResults(accumulatedResistance, currentSegment + 1, pathData.path.length, segmentResistance);
                }
            }
            
            const timeout = setTimeout(animateParticle, 40);
            this.animationTimeouts.push(timeout);
        };
        
        // Start animation
        this.showProgressivePathResults(accumulatedResistance, 1, pathData.path.length);
        const timeout = setTimeout(animateParticle, 100);
        this.animationTimeouts.push(timeout);
    }
    
    addMultiPathParticle(x, y, color, pathIndex) {
        // Add or update moving particle trace for multi-path animation
        const particleName = `Moving Particle ${pathIndex + 1}`;
        const particleTrace = {
            x: [x],
            y: [y],
            mode: 'markers',
            marker: {
                color: color,
                size: 12,
                symbol: 'circle',
                line: { color: 'white', width: 2 }
            },
            name: particleName,
            showlegend: false,
            hoverinfo: 'skip'
        };
        
        try {
            // Check if particle trace already exists
            const plotDiv = document.getElementById(this.containerId);
            const existingTraces = plotDiv.data || [];
            const particleTraceIndex = existingTraces.findIndex(trace => trace.name === particleName);
            
            if (particleTraceIndex >= 0) {
                Plotly.restyle(this.containerId, {
                    x: [[x]],
                    y: [[y]]
                }, particleTraceIndex);
            } else {
                Plotly.addTraces(this.containerId, particleTrace);
            }
        } catch (e) {
            console.log('Multi-path particle animation error:', e);
        }
    }
    
    addEmptyPathTrace(pathData, pathIndex, color) {
        const emptyTrace = {
            x: [],
            y: [],
            mode: 'lines+markers',
            line: { color: color, width: 4 },
            marker: { color: color, size: 8 },
            name: `Path ${pathIndex + 1} (${pathData.totalResistance.toFixed(3)}Ω)`,
            showlegend: true
        };
        
        try {
            Plotly.addTraces(this.containerId, emptyTrace);
        } catch (e) {
            console.log('Error adding empty path trace:', e);
        }
    }
    
    getPathTraceIndex(pathIndex) {
        // Calculate the trace index for this path
        // Base traces: grid(1) + domains(3) + instances(1) + source(1) + target(1) = 7
        // Then each path trace is added in order
        return 7 + pathIndex;
    }
    
    addFlowingParticles(pathData, pathIndex, color) {
        // Add animated flowing particles along the path
        const particles = [];
        const numParticles = 3;
        
        for (let p = 0; p < numParticles; p++) {
            particles.push({
                position: p / numParticles, // Position along path (0-1)
                speed: 0.02 + Math.random() * 0.01 // Slightly different speeds
            });
        }
        
        const animateParticles = () => {
            const particleX = [];
            const particleY = [];
            
            particles.forEach(particle => {
                // Update particle position
                particle.position += particle.speed;
                if (particle.position > 1) {
                    particle.position = 0; // Reset to start
                }
                
                // Interpolate position along path
                const segmentIndex = Math.floor(particle.position * (pathData.path.length - 1));
                const segmentProgress = (particle.position * (pathData.path.length - 1)) - segmentIndex;
                
                if (segmentIndex < pathData.path.length - 1) {
                    const current = pathData.path[segmentIndex];
                    const next = pathData.path[segmentIndex + 1];
                    
                    const x = current.col + (next.col - current.col) * segmentProgress;
                    const y = current.row + (next.row - current.row) * segmentProgress;
                    
                    particleX.push(x);
                    particleY.push(y);
                }
            });
            
            // Update particle trace
            const particleTraceIndex = this.getPathTraceIndex(pathIndex) + 1;
            
            if (particleX.length > 0) {
                // Add or update particle trace
                try {
                    Plotly.restyle(this.containerId, {
                        x: [particleX],
                        y: [particleY]
                    }, particleTraceIndex);
                } catch (e) {
                    // Add new particle trace if it doesn't exist
                    const particleTrace = {
                        x: particleX,
                        y: particleY,
                        mode: 'markers',
                        marker: {
                            color: color,
                            size: 12,
                            symbol: 'circle',
                            line: { color: 'white', width: 2 }
                        },
                        name: `Flow ${pathIndex + 1}`,
                        showlegend: false,
                        hoverinfo: 'skip'
                    };
                    Plotly.addTraces(this.containerId, particleTrace);
                }
            }
            
            // Continue animation
            const timeout = setTimeout(animateParticles, 50); // 20 FPS
            this.animationTimeouts.push(timeout);
        };
        
        // Start particle animation after a small delay
        const timeout = setTimeout(animateParticles, 300);
        this.animationTimeouts.push(timeout);
    }
    
    visualizeBasePlot() {
        const traces = [];
        
        // Add grid network connections
        const gridX = [];
        const gridY = [];
        
        for (let row = 0; row < this.gridSize.rows; row++) {
            for (let col = 0; col < this.gridSize.cols - 1; col++) {
                gridX.push(col, col + 1, null);
                gridY.push(row, row, null);
            }
        }
        
        for (let col = 0; col < this.gridSize.cols; col++) {
            for (let row = 0; row < this.gridSize.rows - 1; row++) {
                gridX.push(col, col, null);
                gridY.push(row, row + 1, null);
            }
        }
        
        traces.push({
            x: gridX,
            y: gridY,
            mode: 'lines',
            line: { color: '#ddd', width: 1 },
            name: 'Grid Network',
            showlegend: true,
            hoverinfo: 'skip'
        });
        
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
        
        // Add instances
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
        
        Plotly.react(this.containerId, traces);
    }
    
    addSourceTargetHighlights() {
        if (this.selectedSource) {
            const sourceTrace = {
                x: [this.selectedSource.col],
                y: [this.selectedSource.row],
                mode: 'markers',
                marker: {
                    color: 'green',
                    size: 16,
                    symbol: 'star',
                    line: { color: 'darkgreen', width: 2 }
                },
                name: 'Source',
                showlegend: true
            };
            Plotly.addTraces(this.containerId, sourceTrace);
        }
        
        if (this.selectedTarget) {
            const targetTrace = {
                x: [this.selectedTarget.col],
                y: [this.selectedTarget.row],
                mode: 'markers',
                marker: {
                    color: 'orange',
                    size: 16,
                    symbol: 'diamond',
                    line: { color: 'darkorange', width: 2 }
                },
                name: 'Target',
                showlegend: true
            };
            Plotly.addTraces(this.containerId, targetTrace);
        }
    }
    
    updateMultiPathPlot(pathIndex, pathData, color) {
        // Rebuild the entire plot with all current paths (same approach as updatePlot)
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
        
        traces.push({
            x: gridX,
            y: gridY,
            mode: 'lines',
            line: { color: '#ddd', width: 1 },
            name: 'Grid Network',
            showlegend: true,
            hoverinfo: 'skip'
        });
        
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
                    size: 10,
                    symbol: 'square',
                    line: { color: 'white', width: 2 }
                },
                name: `${domain.name} Bumps`,
                text: text,
                hoverinfo: 'text',
                customdata: domain.bumps.map(bump => ({ type: 'bump', data: bump }))
            });
        });
        
        // Add instances
        const instanceX = this.instances.map(inst => inst.col);
        const instanceY = this.instances.map(inst => inst.row);
        const instanceText = this.instances.map(inst => 
            `Instance ${inst.id}<br>Independent Node<br>Resistance: ${inst.resistance.toFixed(3)}Ω`
        );
        
        traces.push({
            x: instanceX,
            y: instanceY,
            mode: 'markers',
            marker: {
                color: '#9B59B6',
                size: 12,
                symbol: 'circle',
                line: { color: 'white', width: 2 }
            },
            name: 'Instances',
            text: instanceText,
            hoverinfo: 'text',
            customdata: this.instances.map(inst => ({ type: 'instance', data: inst }))
        });
        
        // Add all current paths that are being animated
        const pathColors = ['#FF4444', '#44FF44', '#4444FF', '#FFFF44', '#FF44FF', '#44FFFF', '#FFA500', '#800080'];
        
        for (let i = 0; i <= pathIndex; i++) {
            const currentPathProperty = `currentPath${i}`;
            if (this[currentPathProperty] && this[currentPathProperty].length > 1) {
                const pathX = this[currentPathProperty].map(point => point.col);
                const pathY = this[currentPathProperty].map(point => point.row);
                const pathColor = pathColors[i % pathColors.length];
                
                traces.push({
                    x: pathX,
                    y: pathY,
                    mode: 'lines+markers',
                    line: { color: pathColor, width: 4 },
                    marker: { color: pathColor, size: 8 },
                    name: `Path ${i + 1}`,
                    showlegend: true
                });
            }
        }
        
        // Highlight selected source and target
        if (this.selectedSource) {
            traces.push({
                x: [this.selectedSource.col],
                y: [this.selectedSource.row],
                mode: 'markers',
                marker: {
                    color: 'green',
                    size: 16,
                    symbol: 'star',
                    line: { color: 'darkgreen', width: 2 }
                },
                name: 'Source',
                showlegend: true
            });
        }
        
        if (this.selectedTarget) {
            traces.push({
                x: [this.selectedTarget.col],
                y: [this.selectedTarget.row],
                mode: 'markers',
                marker: {
                    color: 'orange',
                    size: 16,
                    symbol: 'diamond',
                    line: { color: 'darkorange', width: 2 }
                },
                name: 'Target',
                showlegend: true
            });
        }
        
        // Update the plot
        Plotly.react(this.containerId, traces);
    }

    // ...existing code...
}

// Global instance
window.plotlyGrid = null;
