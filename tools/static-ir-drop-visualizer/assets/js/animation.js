// Animation Engine for Static IR Drop Visualization

class AnimationEngine {
    constructor() {
        this.animationSpeed = 1.0;
        this.activeAnimations = [];
        this.animationQueue = [];
        this.isAnimating = false;
        
        // Animation parameters
        this.particleCount = 50;
        this.particleLifetime = 3000; // milliseconds
        this.particleSpeed = 100; // pixels per second
        
        // Current flow visualization
        this.currentFlowParticles = [];
        this.currentFlowActive = false;
        
        // Color schemes
        this.currentFlowColors = [
            '#22d3ee', '#38bdf8', '#67e8f9', '#a78bfa', '#f472b6'
        ];
    }
    
    setSpeed(speed) {
        this.animationSpeed = speed;
        this.updateAnimationSpeeds();
    }
    
    updateAnimationSpeeds() {
        // Update existing animations with new speed
        this.activeAnimations.forEach(animation => {
            if (animation.updateSpeed) {
                animation.updateSpeed(this.animationSpeed);
            }
        });
    }
    
    startCurrentFlowAnimation(grid, voltageMap, currentDensityMap) {
        this.stopCurrentFlowAnimation();
        
        this.currentFlowActive = true;
        this.currentFlowParticles = [];
        
        // Generate particle paths based on current density
        const particlePaths = this.generateParticlePaths(grid, voltageMap, currentDensityMap);
        
        // Start animating particles
        particlePaths.forEach((path, index) => {
            setTimeout(() => {
                this.animateParticlePath(path, index);
            }, index * 100); // Stagger particle creation
        });
    }
    
    stopCurrentFlowAnimation() {
        this.currentFlowActive = false;
        this.currentFlowParticles = [];
        this.clearActiveAnimations();
    }
    
    generateParticlePaths(grid, voltageMap, currentDensityMap) {
        const paths = [];
        const rows = grid.gridSize.rows;
        const cols = grid.gridSize.cols;
        
        // Find current source
        const currentSource = grid.instances.find(instance => 
            instance.id === grid.currentSource
        );
        
        if (!currentSource) return paths;
        
        // Generate multiple paths from current source
        for (let i = 0; i < this.particleCount; i++) {
            const path = this.generateSingleParticlePath(
                currentSource, 
                grid, 
                voltageMap, 
                currentDensityMap
            );
            
            if (path.length > 1) {
                paths.push(path);
            }
        }
        
        return paths;
    }
    
    generateSingleParticlePath(source, grid, voltageMap, currentDensityMap) {
        const path = [];
        const rows = grid.gridSize.rows;
        const cols = grid.gridSize.cols;
        
        let currentRow = source.row;
        let currentCol = source.col;
        const maxSteps = 50; // Prevent infinite loops
        let steps = 0;
        
        path.push({ row: currentRow, col: currentCol });
        
        while (steps < maxSteps) {
            // Find next position based on current flow
            const nextPos = this.getNextPosition(
                currentRow, 
                currentCol, 
                grid, 
                voltageMap, 
                currentDensityMap
            );
            
            if (!nextPos || (nextPos.row === currentRow && nextPos.col === currentCol)) {
                break; // No valid next position or stuck
            }
            
            currentRow = nextPos.row;
            currentCol = nextPos.col;
            
            path.push({ row: currentRow, col: currentCol });
            
            // Stop if we reach a domain bump (current sink)
            if (this.isDomainBump(currentRow, currentCol, grid)) {
                break;
            }
            
            steps++;
        }
        
        return path;
    }
    
    getNextPosition(row, col, grid, voltageMap, currentDensityMap) {
        const rows = grid.gridSize.rows;
        const cols = grid.gridSize.cols;
        
        // Get current density at current position
        const currentDensity = currentDensityMap[row][col];
        
        // Choose direction based on current flow
        const directions = [];
        
        // Check all four directions
        if (row > 0) {
            const upFlow = Math.abs(currentDensity.vertical);
            const upVoltage = voltageMap[row - 1][col];
            directions.push({ 
                row: row - 1, 
                col: col, 
                weight: upFlow * (upVoltage > voltageMap[row][col] ? 1 : 0.1)
            });
        }
        
        if (row < rows - 1) {
            const downFlow = Math.abs(currentDensity.vertical);
            const downVoltage = voltageMap[row + 1][col];
            directions.push({ 
                row: row + 1, 
                col: col, 
                weight: downFlow * (downVoltage < voltageMap[row][col] ? 1 : 0.1)
            });
        }
        
        if (col > 0) {
            const leftFlow = Math.abs(currentDensity.horizontal);
            const leftVoltage = voltageMap[row][col - 1];
            directions.push({ 
                row: row, 
                col: col - 1, 
                weight: leftFlow * (leftVoltage < voltageMap[row][col] ? 1 : 0.1)
            });
        }
        
        if (col < cols - 1) {
            const rightFlow = Math.abs(currentDensity.horizontal);
            const rightVoltage = voltageMap[row][col + 1];
            directions.push({ 
                row: row, 
                col: col + 1, 
                weight: rightFlow * (rightVoltage < voltageMap[row][col] ? 1 : 0.1)
            });
        }
        
        // Choose direction probabilistically based on weights
        return this.weightedRandomChoice(directions);
    }
    
    weightedRandomChoice(directions) {
        if (directions.length === 0) return null;
        
        const totalWeight = directions.reduce((sum, dir) => sum + dir.weight, 0);
        if (totalWeight === 0) {
            // Random choice if no weights
            return directions[Math.floor(Math.random() * directions.length)];
        }
        
        const randomValue = Math.random() * totalWeight;
        let weightSum = 0;
        
        for (const direction of directions) {
            weightSum += direction.weight;
            if (randomValue <= weightSum) {
                return direction;
            }
        }
        
        return directions[directions.length - 1];
    }
    
    isDomainBump(row, col, grid) {
        return grid.domains.some(domain => 
            domain.bumps.some(bump => bump.row === row && bump.col === col)
        );
    }
    
    animateParticlePath(path, particleIndex) {
        if (!this.currentFlowActive || path.length < 2) return;
        
        const particle = {
            id: `particle-${particleIndex}`,
            path: path,
            currentStep: 0,
            color: this.currentFlowColors[particleIndex % this.currentFlowColors.length],
            size: 4 + Math.random() * 4,
            opacity: 0.8,
            speed: this.particleSpeed * (0.5 + Math.random() * 0.5)
        };
        
        this.currentFlowParticles.push(particle);
        
        // Start particle animation
        this.animateParticle(particle);
    }
    
    animateParticle(particle) {
        if (!this.currentFlowActive) return;
        
        const animationDuration = 1000 / this.animationSpeed;
        
        const animateStep = () => {
            if (!this.currentFlowActive || particle.currentStep >= particle.path.length - 1) {
                // Remove particle
                this.removeParticle(particle.id);
                return;
            }
            
            const currentPos = particle.path[particle.currentStep];
            const nextPos = particle.path[particle.currentStep + 1];
            
            // Add particle to plot
            this.addParticleToPlot(particle, currentPos);
            
            // Schedule next step
            setTimeout(() => {
                particle.currentStep++;
                animateStep();
            }, animationDuration);
        };
        
        animateStep();
    }
    
    addParticleToPlot(particle, position) {
        const containerId = 'irDropPlot';
        
        const particleTrace = {
            x: [position.col],
            y: [position.row],
            mode: 'markers',
            marker: {
                color: particle.color,
                size: particle.size,
                opacity: particle.opacity,
                symbol: 'circle',
                line: { color: '#ffffff', width: 1 }
            },
            showlegend: false,
            hoverinfo: 'skip',
            name: particle.id
        };
        
        // Add trace
        Plotly.addTraces(containerId, [particleTrace]);
        
        // Remove after a short delay
        setTimeout(() => {
            this.removeParticleFromPlot(particle.id);
        }, 500);
    }
    
    removeParticleFromPlot(particleId) {
        const containerId = 'irDropPlot';
        const plotElement = document.getElementById(containerId);
        
        if (plotElement && plotElement.data) {
            const traceIndex = plotElement.data.findIndex(trace => trace.name === particleId);
            if (traceIndex !== -1) {
                Plotly.deleteTraces(containerId, [traceIndex]);
            }
        }
    }
    
    removeParticle(particleId) {
        this.currentFlowParticles = this.currentFlowParticles.filter(
            particle => particle.id !== particleId
        );
    }
    
    clearActiveAnimations() {
        this.activeAnimations.forEach(animation => {
            if (animation.stop) {
                animation.stop();
            }
        });
        this.activeAnimations = [];
    }
    
    // Voltage animation methods
    animateVoltageTransition(fromVoltageMap, toVoltageMap, duration = 1000) {
        if (!fromVoltageMap || !toVoltageMap) return;
        
        const steps = 20;
        const stepDuration = duration / steps;
        
        for (let step = 0; step <= steps; step++) {
            setTimeout(() => {
                const interpolatedMap = this.interpolateVoltageMaps(
                    fromVoltageMap, 
                    toVoltageMap, 
                    step / steps
                );
                
                this.updateVoltageVisualization(interpolatedMap);
            }, step * stepDuration);
        }
    }
    
    interpolateVoltageMaps(fromMap, toMap, t) {
        const interpolatedMap = [];
        
        for (let row = 0; row < fromMap.length; row++) {
            interpolatedMap[row] = [];
            for (let col = 0; col < fromMap[row].length; col++) {
                const fromValue = fromMap[row][col];
                const toValue = toMap[row][col];
                interpolatedMap[row][col] = fromValue + (toValue - fromValue) * t;
            }
        }
        
        return interpolatedMap;
    }
    
    updateVoltageVisualization(voltageMap) {
        // This would update the heatmap visualization
        // Implementation depends on the visualization library
        if (window.plotlyGrid) {
            window.plotlyGrid.voltageMap = voltageMap;
            window.plotlyGrid.updatePlot();
        }
    }
    
    // Grid generation animation
    animateGridGeneration(grid, callback) {
        const steps = [
            { name: 'Grid Lines', duration: 500 },
            { name: 'Domain Bumps', duration: 800 },
            { name: 'Instances', duration: 600 }
        ];
        
        let currentStep = 0;
        
        const executeStep = () => {
            if (currentStep >= steps.length) {
                if (callback) callback();
                return;
            }
            
            const step = steps[currentStep];
            
            // Execute step animation
            this.animateGridStep(step.name, step.duration);
            
            setTimeout(() => {
                currentStep++;
                executeStep();
            }, step.duration);
        };
        
        executeStep();
    }
    
    animateGridStep(stepName, duration) {
        // Implement specific grid generation animations
        switch (stepName) {
            case 'Grid Lines':
                this.animateGridLinesAppearance(duration);
                break;
            case 'Domain Bumps':
                this.animateDomainBumpsAppearance(duration);
                break;
            case 'Instances':
                this.animateInstancesAppearance(duration);
                break;
        }
    }
    
    animateGridLinesAppearance(duration) {
        // Animate grid lines appearing
        // This would be implemented with the visualization library
    }
    
    animateDomainBumpsAppearance(duration) {
        // Animate domain bumps appearing
        // This would be implemented with the visualization library
    }
    
    animateInstancesAppearance(duration) {
        // Animate instances appearing
        // This would be implemented with the visualization library
    }
    
    // Utility methods
    createEaseInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }
    
    createEaseInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    lerp(start, end, t) {
        return start + (end - start) * t;
    }
    
    // Clean up resources
    destroy() {
        this.stopCurrentFlowAnimation();
        this.clearActiveAnimations();
        this.currentFlowParticles = [];
        this.animationQueue = [];
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnimationEngine;
}
