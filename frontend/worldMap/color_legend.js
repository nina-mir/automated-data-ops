export function createColorLegendBar(container, colorScale, options = {}) {
    const {
      width = 900,
      height = 10,
      marginTop = 20,
      marginRight = 5,
      marginBottom = 30,
      marginLeft = 5,
      ticks = 5,
      tickFormat = d3.format(".0f"),
      title = "Altitude (km or miles!])"
    } = options;
  
    const svg = d3.select(container)
      .append("svg")
      .attr("width", width + marginLeft + marginRight)
      .attr("height", height + marginTop + marginBottom);
  
    const g = svg.append("g")
      .attr("transform", `translate(${marginLeft},${marginTop})`);
  
    // Create gradient definition
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "altitude-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");
  
    // Add color stops
    const domain = colorScale.domain();
    const numStops = 100;
    for (let i = 0; i <= numStops; i++) {
      const value = domain[0] + (domain[1] - domain[0]) * (i / numStops);
      gradient.append("stop")
        .attr("offset", `${(i / numStops) * 100}%`)
        .attr("stop-color", colorScale(value));
    }
  
    // Draw the color bar
    g.append("rect")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "url(#altitude-gradient)")
      .style("stroke", "#000")
      .style("stroke-width", 1);
  
    // Add scale
    const scale = d3.scaleLinear()
      .domain(domain)
      .range([0, width]);
  
    const axis = d3.axisBottom(scale)
      .ticks(ticks)
      .tickFormat(tickFormat);
  
    g.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(axis);
  
    // Add title
    g.append("text")
      .attr("x", 0)
      .attr("y", -5)
      .attr("text-anchor", "start")
      .style("font-size", "1rem")
      .text(title);
  
    return svg.node();
  }
  
//   // Usage
//   const legendContainer = d3.select("#legend-container");
//   createColorLegend(legendContainer.node(), colorScale, {
//     width: 250,
//     ticks: 6,
//     title: "Balloon Altitude (meters)"
//   });