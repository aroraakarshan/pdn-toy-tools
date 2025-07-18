// IR Drop Calculation Engine for Static Analysis

class IRDropEngine {
    constructor() {
        this.grid = null;
        this.nodeVoltages = null;
        this.currentDensity = null;
        this.powerLoss = null;
        
        // Physical constants
        this.VDD = 1.0; // Supply voltage (V)
        this.convergenceThreshold = 1e-6;
        this.maxIterations = 1000;
    }
    
    setGrid(grid) {
        this.grid = grid;
        this.initializeCalculationArrays();
    }
    
    initializeCalculationArrays() {
        const rows = this.grid.gridSize.rows;
        const cols = this.grid.gridSize.cols;
        
        // Initialize voltage array
        this.nodeVoltages = [];
        for (let row = 0; row < rows; row++) {
            this.nodeVoltages[row] = [];
            for (let col = 0; col < cols; col++) {
                this.nodeVoltages[row][col] = 0;
            }
        }
        
        // Initialize current density array
        this.currentDensity = [];
        for (let row = 0; row < rows; row++) {
            this.currentDensity[row] = [];
            for (let col = 0; col < cols; col++) {
                this.currentDensity[row][col] = { horizontal: 0, vertical: 0 };
            }
        }
        
        // Initialize power loss array
        this.powerLoss = [];
        for (let row = 0; row < rows; row++) {
            this.powerLoss[row] = [];
            for (let col = 0; col < cols; col++) {
                this.powerLoss[row][col] = 0;
            }
        }
    }
    
    calculateStaticIRDrop(currentSource, currentValueMa) {
        if (!this.grid) {
            console.error('Grid not set for IR drop calculation');
            return null;
        }
        
        const currentA = currentValueMa / 1000; // Convert to Amperes
        
        // Reset arrays
        this.initializeCalculationArrays();
        
        // Set boundary conditions
        this.setBoundaryConditions(currentSource, currentA);
        
        // Solve using iterative method (Gauss-Seidel)
        const converged = this.solveVoltageDistribution();
        
        if (!converged) {
            console.warn('Voltage distribution calculation did not converge');
        }
        
        // Calculate current density
        this.calculateCurrentDensity();
        
        // Calculate power loss
        this.calculatePowerLoss();
        
        return this.getResults();
    }
    
    setBoundaryConditions(currentSource, currentA) {
        const rows = this.grid.gridSize.rows;
        const cols = this.grid.gridSize.cols;
        
        // Set all domain bumps to VDD (assuming they're connected to supply)
        this.grid.domains.forEach(domain => {
            domain.bumps.forEach(bump => {
                this.nodeVoltages[bump.row][bump.col] = this.VDD;
            });
        });
        
        // Current source creates voltage based on its resistance
        // For simplicity, we'll inject current at the source node
        if (currentSource) {
            // The current source will have its voltage determined by the network
            // We'll handle this in the iterative solver
        }
    }
    
    solveVoltageDistribution() {
        const rows = this.grid.gridSize.rows;
        const cols = this.grid.gridSize.cols;
        const gridRes = this.grid.gridResistances;
        
        let iteration = 0;
        let maxChange = Infinity;
        
        while (iteration < this.maxIterations && maxChange > this.convergenceThreshold) {
            maxChange = 0;
            
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    // Skip if this is a domain bump (fixed voltage)
                    if (this.isDomainBump(row, col)) {
                        continue;
                    }
                    
                    const oldVoltage = this.nodeVoltages[row][col];
                    
                    // Calculate new voltage based on neighboring nodes
                    const newVoltage = this.calculateNodeVoltage(row, col);
                    
                    this.nodeVoltages[row][col] = newVoltage;
                    
                    const change = Math.abs(newVoltage - oldVoltage);
                    if (change > maxChange) {
                        maxChange = change;
                    }
                }
            }
            
            iteration++;
        }
        
        return iteration < this.maxIterations;
    }
    
    calculateNodeVoltage(row, col) {
        const gridRes = this.grid.gridResistances;
        const rows = this.grid.gridSize.rows;
        const cols = this.grid.gridSize.cols;
        
        let sumVoltageOverResistance = 0;
        let sumInverseResistance = 0;
        
        // Check all four neighbors
        const neighbors = [
            { row: row - 1, col: col, resistance: row > 0 ? gridRes[row - 1][col].down : null },
            { row: row + 1, col: col, resistance: row < rows - 1 ? gridRes[row][col].down : null },
            { row: row, col: col - 1, resistance: col > 0 ? gridRes[row][col - 1].right : null },
            { row: row, col: col + 1, resistance: col < cols - 1 ? gridRes[row][col].right : null }
        ];
        
        neighbors.forEach(neighbor => {
            if (neighbor.resistance !== null && 
                neighbor.row >= 0 && neighbor.row < rows && 
                neighbor.col >= 0 && neighbor.col < cols) {
                
                const neighborVoltage = this.nodeVoltages[neighbor.row][neighbor.col];
                const conductance = 1 / neighbor.resistance;
                
                sumVoltageOverResistance += neighborVoltage * conductance;
                sumInverseResistance += conductance;
            }
        });
        
        // Handle current injection for current source
        let currentInjection = 0;
        if (this.isCurrentSource(row, col)) {
            // Current injection will be handled by the boundary conditions
            // For now, we'll use a simple approximation
            currentInjection = this.getCurrentInjection(row, col);
        }
        
        if (sumInverseResistance > 0) {
            return (sumVoltageOverResistance + currentInjection) / sumInverseResistance;
        }
        
        return this.nodeVoltages[row][col]; // No change if no connections
    }
    
    isDomainBump(row, col) {
        return this.grid.domains.some(domain => 
            domain.bumps.some(bump => bump.row === row && bump.col === col)
        );
    }
    
    isCurrentSource(row, col) {
        return this.grid.instances.some(instance => 
            instance.row === row && instance.col === col && instance.id === this.grid.currentSource
        );
    }
    
    getCurrentInjection(row, col) {
        // This is a simplified current injection model
        // In practice, you'd need to solve the full system of equations
        return 0; // Placeholder
    }
    
    calculateCurrentDensity() {
        const rows = this.grid.gridSize.rows;
        const cols = this.grid.gridSize.cols;
        const gridRes = this.grid.gridResistances;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Horizontal current density
                if (col < cols - 1) {
                    const voltageDiff = this.nodeVoltages[row][col] - this.nodeVoltages[row][col + 1];
                    const resistance = gridRes[row][col].right;
                    this.currentDensity[row][col].horizontal = voltageDiff / resistance;
                }
                
                // Vertical current density
                if (row < rows - 1) {
                    const voltageDiff = this.nodeVoltages[row][col] - this.nodeVoltages[row + 1][col];
                    const resistance = gridRes[row][col].down;
                    this.currentDensity[row][col].vertical = voltageDiff / resistance;
                }
            }
        }
    }
    
    calculatePowerLoss() {
        const rows = this.grid.gridSize.rows;
        const cols = this.grid.gridSize.cols;
        const gridRes = this.grid.gridResistances;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                let totalPowerLoss = 0;
                
                // Power loss in horizontal resistor
                if (col < cols - 1) {
                    const current = this.currentDensity[row][col].horizontal;
                    const resistance = gridRes[row][col].right;
                    totalPowerLoss += current * current * resistance;
                }
                
                // Power loss in vertical resistor
                if (row < rows - 1) {
                    const current = this.currentDensity[row][col].vertical;
                    const resistance = gridRes[row][col].down;
                    totalPowerLoss += current * current * resistance;
                }
                
                this.powerLoss[row][col] = totalPowerLoss;
            }
        }
    }
    
    getResults() {
        const rows = this.grid.gridSize.rows;
        const cols = this.grid.gridSize.cols;
        
        // Calculate statistics
        let minVoltage = Infinity;
        let maxVoltage = -Infinity;
        let totalPowerLoss = 0;
        let maxIRDrop = 0;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const voltage = this.nodeVoltages[row][col];
                const irDrop = this.VDD - voltage;
                
                if (voltage < minVoltage) minVoltage = voltage;
                if (voltage > maxVoltage) maxVoltage = voltage;
                if (irDrop > maxIRDrop) maxIRDrop = irDrop;
                
                totalPowerLoss += this.powerLoss[row][col];
            }
        }
        
        return {
            voltageMap: this.nodeVoltages,
            currentDensityMap: this.currentDensity,
            powerLossMap: this.powerLoss,
            statistics: {
                minVoltage: minVoltage,
                maxVoltage: maxVoltage,
                maxIRDrop: maxIRDrop,
                totalPowerLoss: totalPowerLoss,
                voltageDrop: maxVoltage - minVoltage
            }
        };
    }
    
    // Utility methods for analysis
    getVoltageAt(row, col) {
        if (this.nodeVoltages && 
            row >= 0 && row < this.nodeVoltages.length &&
            col >= 0 && col < this.nodeVoltages[row].length) {
            return this.nodeVoltages[row][col];
        }
        return null;
    }
    
    getCurrentDensityAt(row, col) {
        if (this.currentDensity && 
            row >= 0 && row < this.currentDensity.length &&
            col >= 0 && col < this.currentDensity[row].length) {
            return this.currentDensity[row][col];
        }
        return null;
    }
    
    getPowerLossAt(row, col) {
        if (this.powerLoss && 
            row >= 0 && row < this.powerLoss.length &&
            col >= 0 && col < this.powerLoss[row].length) {
            return this.powerLoss[row][col];
        }
        return null;
    }
    
    // Export results for visualization
    exportResults() {
        return {
            voltages: this.nodeVoltages,
            currentDensity: this.currentDensity,
            powerLoss: this.powerLoss,
            statistics: this.getResults().statistics
        };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IRDropEngine;
}
