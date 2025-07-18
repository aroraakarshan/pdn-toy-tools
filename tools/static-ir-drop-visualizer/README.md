# Static IR Drop Visualizer

An interactive educational tool for visualizing static IR drop analysis in Power Delivery Networks (PDN). This tool helps understand voltage distribution, current flow, and power dissipation in grid-based power delivery systems.

## Features

### Interactive Grid Visualization
- **10x10 Grid Network**: Realistic power delivery network with configurable resistance values
- **Domain System**: 3 color-coded domains (A, B, C) with multiple connection points (bumps)
- **Instance Sources**: 7 scattered instances that can act as current sources
- **Real-time Interaction**: Click-to-select current sources and domains

### Static IR Drop Analysis
- **Voltage Distribution**: Heat map visualization showing voltage levels across the grid
- **Current Flow**: Animated particles showing current distribution paths
- **Power Loss Calculation**: Real-time power dissipation analysis
- **Resistance Network**: Configurable resistance values for realistic modeling

### Educational Features
- **Interactive Tutorial**: Step-by-step guidance through IR drop concepts
- **Real-time Analysis**: Live voltage calculations and IR drop measurements
- **Color-coded Visualization**: Intuitive heat map from blue (low) to red (high IR drop)
- **Detailed Results**: Comprehensive analysis with voltage, current, and power metrics

### Animation & Visualization
- **Smooth Animations**: Fluid transitions and particle animations
- **Adjustable Speed**: Control animation speed from 0.5x to 3x
- **Multiple Display Options**: Toggle voltage values and current flow visualization
- **Interactive Controls**: Real-time parameter adjustment

## How to Use

1. **Open the Tool**: Navigate to the Static IR Drop Visualizer
2. **Generate Network**: Click "Generate New Network" to create a fresh grid layout
3. **Select Current Source**: Choose an instance to act as the current source
4. **Set Current Value**: Adjust the current using the slider (10-1000mA)
5. **Simulate IR Drop**: Click "Simulate IR Drop" to calculate voltage distribution
6. **Animate Flow**: Use "Animate Current Flow" to visualize current paths
7. **Analyze Results**: View detailed analysis in the results panel

## Technical Details

### Grid Structure
- **Size**: 10x10 nodes with configurable resistance values
- **Domains**: Low-resistance connection points to power supplies
- **Instances**: Current sources with higher resistance values
- **Resistance Range**: 0.05-0.2Ω for grid segments, 0.01-0.05Ω for domain bumps

### IR Drop Calculation
- **Method**: Nodal analysis with iterative solver (Gauss-Seidel)
- **Convergence**: 1e-6 threshold with maximum 1000 iterations
- **Current Distribution**: Calculated based on voltage gradients and resistance
- **Power Loss**: I²R losses computed for each grid segment

### Visualization Technology
- **Plotly.js**: Interactive 2D grid visualization with zoom/pan capabilities
- **Heat Maps**: Real-time voltage distribution visualization
- **Particle Animation**: WebGL-accelerated current flow animation
- **Responsive Design**: Works on desktop and mobile devices

## Educational Value

This tool demonstrates:
- **Ohm's Law**: Relationship between voltage, current, and resistance
- **Kirchhoff's Laws**: Current and voltage conservation in networks
- **Power Dissipation**: I²R losses in resistive networks
- **Voltage Regulation**: Impact of resistance on voltage distribution
- **Current Distribution**: How current flows through parallel paths

## File Structure

```
static-ir-drop-visualizer/
├── index.html                 # Main application entry point
├── assets/
│   ├── css/
│   │   └── visualizer.css     # Styling and visual design
│   ├── js/
│   │   ├── visualizer.js      # Main application controller
│   │   ├── plotly-grid.js     # Grid visualization and interaction
│   │   ├── ir-drop-engine.js  # IR drop calculation engine
│   │   └── animation.js       # Animation and particle effects
│   └── data/
│       └── sample_grid.json   # Sample grid configuration
└── README.md                  # This documentation
```

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **WebGL Support**: Required for smooth animations
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Future Enhancements

- **Advanced Solver**: More sophisticated numerical methods
- **3D Visualization**: Three-dimensional grid representation
- **Frequency Domain**: AC analysis capabilities
- **Import/Export**: Save and load grid configurations
- **Batch Analysis**: Multiple scenario comparison

## License

This tool is part of the PDN Toy Tools collection and is intended for educational use.
