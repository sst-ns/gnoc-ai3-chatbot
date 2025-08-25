import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// Initialize AWS S3 Client
const s3Client = new S3Client({ region: process.env.region || 'us-west-2' });
const BUCKET_NAME = process.env.bucket_name || 'gnocai3data';

// Default color palette for charts
const defaultColors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#F7464A', '#46BFBD', '#FDB45C', '#949FB1',
    '#2196F3', '#4CAF50', '#FFEB3B', '#FF5722', '#607D8B'
];

/**
 * Safely gets a nested property from an object.
 */
const get = (obj, path, defaultValue = undefined) => {
    const travel = (regexp) =>
        String.prototype.split
        .call(path, regexp)
        .filter(Boolean)
        .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
    const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
    return result === undefined || result === obj ? defaultValue : result;
};

/**
 * Gets the proper color for a chart element based on Chart.js logic
 * @param {object} dataset - The dataset object
 * @param {number} dataIndex - Index of the data point (for categories)
 * @param {number} datasetIndex - Index of the dataset (for series)
 * @param {boolean} isStacked - Whether the chart is stacked
 * @param {boolean} isPieChart - Whether this is a pie chart
 * @returns {string} The color to use
 */
function getChartColor(dataset, dataIndex, datasetIndex, isStacked = false, isPieChart = false) {
    const backgroundColor = dataset.backgroundColor;
    const borderColor = dataset.borderColor;
    
    let color;
    
    if (Array.isArray(backgroundColor)) {
        if (isPieChart || (!isStacked && backgroundColor.length > 1)) {
            // Pie chart or non-stacked with array: use category-based coloring
            color = backgroundColor[dataIndex] || backgroundColor[dataIndex % backgroundColor.length];
        } else if (isStacked && backgroundColor.length === 1) {
            // Stacked with single-element array: use that color for all
            color = backgroundColor[0];
        } else {
            // Stacked with multiple colors: use dataset-based cycling
            color = backgroundColor[datasetIndex % backgroundColor.length];
        }
    } else if (backgroundColor) {
        // Single background color
        color = backgroundColor;
    } else if (Array.isArray(borderColor)) {
        // Fall back to border color array
        if (isPieChart || (!isStacked && borderColor.length > 1)) {
            color = borderColor[dataIndex] || borderColor[dataIndex % borderColor.length];
        } else {
            color = borderColor[datasetIndex % borderColor.length];
        }
    } else if (borderColor) {
        // Fall back to single border color
        color = borderColor;
    } else {
        // Final fallback to default colors
        if (isPieChart || !isStacked) {
            color = defaultColors[dataIndex % defaultColors.length];
        } else {
            color = defaultColors[datasetIndex % defaultColors.length];
        }
    }
    
    return color || '#000000'; // Ensure we never return undefined
}

/**
 * Estimates the required height for X-axis labels and determines if they should be rotated.
 * @param {string[]} labels - The array of X-axis labels.
 * @param {number} chartWidth - The width of the chart area.
 * @param {number} fontSize - The font size of the labels.
 * @returns {{shouldRotate: boolean, requiredHeight: number}}
 */
function calculateXLabelDimensions(labels, chartWidth, fontSize = 10) {
    if (!labels || labels.length === 0) {
        return { shouldRotate: false, requiredHeight: 20 };
    }

    // Find the longest label text
    const longestLabel = labels.reduce((a, b) => (a.length > b.length ? a : b), '');

    // --- Dynamic Rotation Trigger ---
    // Heuristic: Estimate the total width of all labels if laid out horizontally.
    // An average character width is roughly 0.6 * fontSize.
    const estimatedTotalWidth = labels.length * (longestLabel.length * fontSize * 0.6);
    // Rotate if the total estimated width is too wide for the chart,
    // or if we have many labels, or if a single label is very long.
    const shouldRotate =
        estimatedTotalWidth > chartWidth ||
        labels.length > 15 ||
        longestLabel.length > 15;

    if (!shouldRotate) {
        // If not rotating, required height is just the font size plus some margin.
        return { shouldRotate: false, requiredHeight: fontSize + 10 };
    }

    // --- Dynamic Height Calculation for Rotated Labels ---
    // Estimate the pixel width of the longest label.
    // This is a heuristic as we can't measure text perfectly on the backend.
    const estimatedLabelWidth = longestLabel.length * fontSize * 0.6;

    // Calculate the vertical projection of the label when rotated 45 degrees.
    // Using sin(45 degrees) which is roughly 0.707.
    const requiredHeight = estimatedLabelWidth * Math.sin(Math.PI / 4) + (fontSize / 2);

    // Return the calculated dimensions, with a minimum safeguard.
    return {
        shouldRotate: true,
        requiredHeight: Math.max(60, requiredHeight) // Ensure a minimum height of 60px.
    };
}


/**
 * Calculates a "nice" Y-axis maximum value and tick step.
 */
function calculateNiceYAxis(config) {
    const datasets = get(config, 'data.datasets', []);
    const labels = get(config, 'data.labels', []);
    const isStacked = 
        (get(config, 'options.scales.x.stacked', false) && get(config, 'options.scales.y.stacked', false)) ||
        (get(config, 'options.scales.xAxes.0.stacked', false) && get(config, 'options.scales.yAxes.0.stacked', false));

    let dataMax;
    if (isStacked) {
        const sums = labels.map((_, i) => datasets.reduce((sum, ds) => sum + (ds.data[i] || 0), 0));
        dataMax = Math.max(0, ...sums);
    } else {
        const allData = datasets.flatMap(ds => ds.data.filter(val => val != null));
        dataMax = Math.max(0, ...allData);
    }

    const configYMax = get(config, 'options.scales.y.max') || get(config, 'options.scales.yAxes.0.ticks.max');
    if (configYMax != null) {
        const tickCount = 5;
        const tickStep = configYMax > 0 ? configYMax / tickCount : 1;
        return { yMax: configYMax, tickStep: tickStep };
    }

    if (dataMax === 0) {
        return { yMax: 10, tickStep: 2 };
    }

    const tickCount = 5; // Desired number of ticks
    const roughStep = dataMax / tickCount;
    const exponent = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const fraction = roughStep / exponent;
    
    let niceFraction;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    
    const tickStep = niceFraction * exponent;
    const yMax = Math.ceil(dataMax / tickStep) * tickStep;
    
    return { yMax, tickStep };
}

/**
 * Generates the SVG for the chart title.
 */
function generateTitleSVG(options, width) {
    const titleText = get(options, 'plugins.title.text') || get(options, 'title.text');
    const titleDisplay = get(options, 'plugins.title.display') || get(options, 'title.display', !!titleText);
    
    if (!titleDisplay || !titleText) {
        return '';
    }
    
    const fontSize = get(options, 'plugins.title.font.size') || get(options, 'title.fontSize', 18);
    const fontColor = get(options, 'plugins.title.color') || get(options, 'title.fontColor', '#000');
    
    return `<text x="${width / 2}" y="${fontSize + 12}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="${fontColor}">${titleText}</text>`;
}

/**
 * Calculates the actual dimensions including all axis labels and titles
 */
function calculateActualChartBounds(config, padding, chartHeight, chartWidth, labels) {
    // We get the label dimensions from our new dynamic function.
    const labelDimensions = calculateXLabelDimensions(labels, chartWidth);
    
    // The required height for the labels is now dynamic.
    const xLabelHeight = labelDimensions.requiredHeight;
    
    const xLabel = get(config, 'options.scales.x.title.text') || get(config, 'options.scales.xAxes.0.scaleLabel.labelString', '');
    const xTitleHeight = xLabel ? 25 : 0;
    
    const yLabel = get(config, 'options.scales.y.title.text') || get(config, 'options.scales.yAxes.0.scaleLabel.labelString', '');
    const yTitleWidth = yLabel ? 30 : 0;
    
    const yLabelWidth = 50;
    
    return {
        left: padding.left,
        top: padding.top,
        right: padding.left + chartWidth,
        bottom: padding.top + chartHeight + xLabelHeight + xTitleHeight,
        actualLeft: padding.left - yTitleWidth,
        actualRight: padding.left + chartWidth + yLabelWidth,
        actualBottom: padding.top + chartHeight + xLabelHeight + xTitleHeight,
        width: chartWidth,
        height: chartHeight,
        xLabelHeight: xLabelHeight, // This is now dynamic
        xTitleHeight: xTitleHeight,
        yTitleWidth: yTitleWidth,
        yLabelWidth: yLabelWidth
    };
}


/**
 * Calculates the legend dimensions and returns layout information.
 */
function calculateLegendLayout(config, width, height) {
    const legendDisplay = get(config, 'options.plugins.legend.display') || get(config, 'options.legend.display', true);
    
    if (!legendDisplay) {
        return { width: 0, height: 0, position: 'none', actualHeight: 0, actualWidth: 0 };
    }

    const labels = get(config, 'data.labels', []);
    const datasets = get(config, 'data.datasets', []);
    const isPieChart = get(config, 'type', '').toLowerCase() === 'pie';

    let legendItems = [];
    if (isPieChart) {
        const data = get(datasets, '0.data', []);
        legendItems = labels.filter((_, i) => (data[i] || 0) > 0);
    } else {
        // For bar/line charts, create legend based on how colors are actually assigned
        const isStacked = get(config, 'options.scales.x.stacked', false) && get(config, 'options.scales.y.stacked', false);
        
        if (datasets.length === 1 && Array.isArray(datasets[0].backgroundColor)) {
            // Single dataset with array colors - legend shows categories
            const data = get(datasets, '0.data', []);
            legendItems = labels.filter((_, i) => (data[i] || 0) > 0);
        } else {
            // Multiple datasets or single color - legend shows datasets
            legendItems = datasets.filter(ds => ds.data.reduce((sum, val) => sum + (val || 0), 0) > 0);
        }
    }

    const position = get(config, 'options.plugins.legend.position') || get(config, 'options.legend.position', 'bottom');
    const itemHeight = 24;
    const itemWidth = 200;
    const bgPadding = 15;
    const legendMargin = 25;
    
    let legendWidth = 0, legendHeight = 0, actualWidth = 0, actualHeight = 0;
    
    switch(position) {
        case 'top':
        case 'bottom':
            const columns = Math.max(1, Math.floor((width - 40) / itemWidth));
            const rows = Math.ceil(legendItems.length / columns);
            legendWidth = Math.min(legendItems.length, columns) * itemWidth;
            legendHeight = rows * itemHeight;
            actualHeight = legendHeight + (bgPadding * 2) + legendMargin;
            actualWidth = legendWidth + (bgPadding * 2);
            break;
        case 'right':
        case 'left':
            legendWidth = itemWidth;
            legendHeight = legendItems.length * itemHeight;
            actualWidth = legendWidth + (bgPadding * 2) + legendMargin;
            actualHeight = legendHeight + (bgPadding * 2);
            break;
    }

    return { 
        width: legendWidth, 
        height: legendHeight, 
        position: position,
        itemCount: legendItems.length,
        actualWidth: actualWidth,
        actualHeight: actualHeight,
        margin: legendMargin,
        padding: bgPadding
    };
}

/**
 * Updates chart padding based on legend layout
 */
function adjustPaddingForLegend(basePadding, legendLayout) {
    const padding = { ...basePadding };
    
    switch(legendLayout.position) {
        case 'top':
            padding.top += legendLayout.actualHeight;
            break;
        case 'bottom':
            padding.bottom += legendLayout.actualHeight;
            break;
        case 'left':
            padding.left += legendLayout.actualWidth;
            break;
        case 'right':
            padding.right += legendLayout.actualWidth;
            break;
    }
    
    return padding;
}

/**
 * Generates the SVG for the chart legend with proper color handling for stacked charts.
 */
function generateLegendSVG(config, width, height, chartBounds = {}, legendLayout = null) {
    const legendDisplay = get(config, 'options.plugins.legend.display') || get(config, 'options.legend.display', true);
    
    if (!legendDisplay || !legendLayout || legendLayout.position === 'none') {
        return '';
    }

    const labels = get(config, 'data.labels', []);
    const datasets = get(config, 'data.datasets', []);
    const isPieChart = get(config, 'type', '').toLowerCase() === 'pie';
    const isStacked = get(config, 'options.scales.x.stacked', false) && get(config, 'options.scales.y.stacked', false);

    let legendItems = [];
    
    if (isPieChart) {
        const data = get(datasets, '0.data', []);
        const total = data.reduce((a, b) => a + b, 0);
        
        legendItems = labels.map((label, i) => ({
            text: label,
            fillStyle: getChartColor(datasets[0], i, 0, false, true),
            value: data[i] || 0,
            percentage: total > 0 ? ((data[i] || 0) / total * 100).toFixed(1) : '0.0'
        })).filter(item => item.value > 0);
    } else {
        // Determine legend type based on data structure
        if (datasets.length === 1 && Array.isArray(datasets[0].backgroundColor)) {
            // Single dataset with array colors - show categories in legend
            const data = get(datasets, '0.data', []);
            legendItems = labels.map((label, i) => ({
                text: label,
                fillStyle: getChartColor(datasets[0], i, 0, isStacked, false),
                value: data[i] || 0,
                percentage: null
            })).filter(item => item.value > 0);
        } else {
            // Multiple datasets or single color - show datasets in legend
            legendItems = datasets.map((ds, i) => {
                const total = ds.data.reduce((sum, val) => sum + (val || 0), 0);
                return {
                    text: ds.label || `Dataset ${i + 1}`,
                    fillStyle: getChartColor(ds, 0, i, isStacked, false),
                    value: total,
                    percentage: null
                };
            }).filter(item => item.value > 0);
        }
    }

    legendItems.sort((a, b) => b.value - a.value);

    const itemHeight = 24;
    const itemWidth = 200;
    const boxSize = 14;
    
    let startX, startY, columns;
    
    switch(legendLayout.position) {
        case 'top':
            columns = Math.max(1, Math.floor((width - 40) / itemWidth));
            startX = (width - (Math.min(legendItems.length, columns) * itemWidth)) / 2;
            startY = legendLayout.padding;
            break;
        case 'bottom':
            columns = Math.max(1, Math.floor((width - 40) / itemWidth));
            startX = (width - (Math.min(legendItems.length, columns) * itemWidth)) / 2;
            startY = chartBounds.actualBottom + legendLayout.margin;
            break;
        case 'right':
            columns = 1;
            startX = chartBounds.actualRight + legendLayout.margin;
            startY = chartBounds.top + (chartBounds.height - legendLayout.height) / 2;
            break;
        case 'left':
            columns = 1;
            startX = legendLayout.padding;
            startY = chartBounds.top + (chartBounds.height - legendLayout.height) / 2;
            break;
        default:
            return '';
    }

    let svg = '';

    // Draw legend background
    if (legendItems.length > 0) {
        const bgX = startX - legendLayout.padding;
        const bgY = startY - legendLayout.padding;
        const bgWidth = legendLayout.actualWidth;
        const bgHeight = legendLayout.actualHeight;
        
        svg += `<rect x="${bgX}" y="${bgY}" width="${bgWidth}" height="${bgHeight}" fill="rgba(255,255,255,0.95)" stroke="#ddd" stroke-width="1" rx="6" />`;
    }

    // Draw legend items
    legendItems.forEach((item, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = startX + col * itemWidth;
        const y = startY + row * itemHeight;

        let legendText = item.text;
        if (legendText.length > 15) {
            legendText = legendText.substring(0, 13) + '...';
        }

        svg += `<rect x="${x}" y="${y + 2}" width="${boxSize}" height="${boxSize}" fill="${item.fillStyle}" stroke="#666" stroke-width="0.5" />`;
        svg += `<text x="${x + boxSize + 8}" y="${y + boxSize - 1}" font-size="12" font-weight="500" fill="#333">${legendText}</text>`;
        
        let valueText = `(${item.value})`;
        if (item.percentage !== null) {
            valueText = `(${item.value} - ${item.percentage}%)`;
        }
        svg += `<text x="${x + boxSize + 8}" y="${y + boxSize + 11}" font-size="10" fill="#666">${valueText}</text>`;
    });

    return svg;
}

/**
 * Generates an SVG for a Bar Chart with enhanced stacked graph support.
 */
function generateBarChartSVG(config) {
    const baseLegendLayout = calculateLegendLayout(config, 900, 600);
    
    let width = 900, height = 600;
    if (baseLegendLayout.position === 'right' || baseLegendLayout.position === 'left') {
        width += baseLegendLayout.actualWidth;
    }
    if (baseLegendLayout.position === 'top' || baseLegendLayout.position === 'bottom') {
        height += baseLegendLayout.actualHeight;
    }

    const labels = get(config, 'data.labels', []);
    const datasets = get(config, 'data.datasets', []);
    if (datasets.length === 0) return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="${width/2}" y="${height/2}" text-anchor="middle">No data</text></svg>`;

    let basePadding = { top: 80, right: 50, bottom: 100, left: 80 };
    
    const chartWidthForLabels = width - basePadding.left - basePadding.right;
    const labelDimensions = calculateXLabelDimensions(labels, chartWidthForLabels, 10);
    
    if (labelDimensions.shouldRotate) {
        // Dynamically add padding based on the calculated required height of the longest label
        basePadding.bottom += labelDimensions.requiredHeight; 
    }

    const padding = adjustPaddingForLegend(basePadding, baseLegendLayout);

    const isStacked = 
        (get(config, 'options.scales.x.stacked', false) && get(config, 'options.scales.y.stacked', false)) ||
        (get(config, 'options.scales.xAxes.0.stacked', false) && get(config, 'options.scales.yAxes.0.stacked', false));
    
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const { yMax, tickStep } = calculateNiceYAxis(config);

    const barGroupWidth = chartWidth / labels.length;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Arial, sans-serif;">`;
    svg += `<rect width="100%" height="100%" fill="white"/>`;
    svg += generateTitleSVG(config.options, width);

    // Grid lines and Y-axis labels
    if (yMax > 0) {
        for (let tick = 0; tick <= yMax; tick += tickStep) {
            const y = padding.top + chartHeight - (tick / yMax) * chartHeight;
            if (y < padding.top) continue;
            
            svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e0e0e0" />`;
            
            const label = Number.isInteger(tick) ? tick : tick.toFixed(tickStep < 1 ? 2 : 1);
            svg += `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="12">${label}</text>`;
        }
    }

    // X-axis labels
    labels.forEach((label, i) => {
        const x = padding.left + i * barGroupWidth + barGroupWidth / 2;
        const y = padding.top + chartHeight + 20;

        // Use the result from our new function to decide whether to rotate
        if (labelDimensions.shouldRotate) {
            svg += `<text transform="translate(${x}, ${y}) rotate(-45)" text-anchor="end" font-size="10">${label}</text>`;
        } else {
            svg += `<text x="${x}" y="${y}" text-anchor="middle" font-size="12">${label}</text>`;
        }
    });

    // Draw bars with enhanced color handling
    const barPadding = 0.1;
    const totalBarWidth = barGroupWidth * (1 - barPadding);
    const barWidth = isStacked ? totalBarWidth : totalBarWidth / datasets.length;
    let yStacked = new Array(labels.length).fill(0);

    datasets.forEach((ds, j) => {
        ds.data.forEach((value, i) => {
            if (value == null) return;
            
            const color = getChartColor(ds, i, j, isStacked, false);
            
            const barHeight = yMax > 0 ? (value / yMax) * chartHeight : 0;
            if (barHeight < 0) return;

            const groupX = padding.left + i * barGroupWidth + (barGroupWidth * barPadding / 2);
            let x, y;
            
            if (isStacked) {
                x = groupX;
                y = padding.top + chartHeight - ((value + yStacked[i]) / yMax) * chartHeight;
                yStacked[i] += value;
            } else {
                x = groupX + j * barWidth;
                y = padding.top + chartHeight - barHeight;
            }
            
            svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" />`;
            
            if (barHeight > 15 && value > 0) {
                const labelX = x + barWidth / 2;
                const labelY = y + barHeight / 2 + 4;
                const textColor = barHeight > 25 ? 'white' : '#333';
                svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="10" font-weight="bold" fill="${textColor}">${value}</text>`;
            }
        });
    });

    // Stacked totals
    if (isStacked) {
        labels.forEach((label, i) => {
            const total = datasets.reduce((sum, ds) => sum + (ds.data[i] || 0), 0);
            if (total > 0) {
                const x = padding.left + i * barGroupWidth + barGroupWidth / 2;
                const y = padding.top + chartHeight - (total / yMax) * chartHeight - 5;
                svg += `<text x="${x}" y="${y}" text-anchor="middle" font-size="11" font-weight="bold" fill="#333">${total}</text>`;
            }
        });
    }

    // Axis titles
    const xLabel = get(config, 'options.scales.x.title.text') || get(config, 'options.scales.xAxes.0.scaleLabel.labelString', '');
    if (xLabel) {
        const titleY = padding.top + chartHeight + 60;
        svg += `<text x="${width / 2}" y="${titleY}" text-anchor="middle" font-size="14" font-weight="bold">${xLabel}</text>`;
    }
    
    const yLabel = get(config, 'options.scales.y.title.text') || get(config, 'options.scales.yAxes.0.scaleLabel.labelString', '');
    if (yLabel) svg += `<text transform="rotate(-90)" x="${-height / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold">${yLabel}</text>`;

    const chartBounds = calculateActualChartBounds(config, padding, chartHeight, chartWidth, labels);

    svg += generateLegendSVG(config, width, height, chartBounds, baseLegendLayout);
    svg += '</svg>';
    return svg;
}

/**
 * Generates an SVG for a Line Chart with enhanced color support.
 */
function generateLineChartSVG(config) {
    const baseLegendLayout = calculateLegendLayout(config, 1100, 800);
    
    let width = 1100, height = 800;
    if (baseLegendLayout.position === 'right' || baseLegendLayout.position === 'left') {
        width += baseLegendLayout.actualWidth;
    }
    if (baseLegendLayout.position === 'top' || baseLegendLayout.position === 'bottom') {
        height += baseLegendLayout.actualHeight;
    }

    const labels = get(config, 'data.labels', []);
    const datasets = get(config, 'data.datasets', []);
    if (datasets.length === 0) return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="${width/2}" y="${height/2}" text-anchor="middle">No data</text></svg>`;

    let basePadding = { top: 100, right: 80, bottom: 150, left: 100 };
    
    const chartWidthForLabels = width - basePadding.left - basePadding.right;
    const labelDimensions = calculateXLabelDimensions(labels, chartWidthForLabels, 10);
    
    if (labelDimensions.shouldRotate) {
        // Dynamically add padding based on the calculated required height of the longest label
        basePadding.bottom += labelDimensions.requiredHeight;
    }

    const padding = adjustPaddingForLegend(basePadding, baseLegendLayout);

    const { yMax, tickStep } = calculateNiceYAxis(config);

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const xStep = labels.length > 1 ? chartWidth / (labels.length - 1) : chartWidth;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Arial, sans-serif;">`;
    svg += `<rect width="100%" height="100%" fill="white"/>`;
    svg += generateTitleSVG(config.options, width);

    // Grid lines and Y-axis labels
    if (yMax > 0) {
        for (let tick = 0; tick <= yMax; tick += tickStep) {
            const y = padding.top + chartHeight - (tick / yMax) * chartHeight;
            if (y < padding.top) continue;

            svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1" />`;
            
            const label = Number.isInteger(tick) ? tick : tick.toFixed(tickStep < 1 ? 2 : 1);
            svg += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${label}</text>`;
        }
    }

    // X-axis labels
    labels.forEach((label, i) => {
        const x = padding.left + i * xStep;
        const y = padding.top + chartHeight + 25;

        // Use the result from our new function to decide whether to rotate
        if (labelDimensions.shouldRotate) {
            svg += `<text transform="translate(${x}, ${y}) rotate(-45)" text-anchor="end" font-size="10" fill="#666">${label}</text>`;
        } else {
            svg += `<text x="${x}" y="${y}" text-anchor="middle" font-size="11" fill="#666">${label}</text>`;
        }
    });

    // Draw lines and points
    datasets.forEach((ds, j) => {
        const color = getChartColor(ds, 0, j, false, false);
        const pointRadius = get(ds, 'pointRadius', 3);
        
        const points = ds.data.map((value, i) => {
            if (value == null) return null;
            const x = padding.left + i * xStep;
            const y = yMax > 0 ? padding.top + chartHeight - (value / yMax) * chartHeight : padding.top + chartHeight;
            return `${x},${y}`;
        }).filter(p => p != null).join(' ');
        
        if (points) {
            svg += `<polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" />`;
        }
        
        if (pointRadius > 0) {
            ds.data.forEach((value, i) => {
                if (value == null) return;
                const x = padding.left + i * xStep;
                const y = yMax > 0 ? padding.top + chartHeight - (value / yMax) * chartHeight : padding.top + chartHeight;
                const pointColor = getChartColor(ds, i, j, false, false);
                svg += `<circle cx="${x}" cy="${y}" r="${pointRadius}" fill="${pointColor}" />`;
                if (value !== 0) {
                    svg += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="9" font-weight="bold" fill="#333">${value}</text>`;
                }
            });
        }
    });

    // Axis titles
    const xLabel = get(config, 'options.scales.x.title.text') || get(config, 'options.scales.xAxes.0.scaleLabel.labelString', '');
    if (xLabel) {
        const titleY = padding.top + chartHeight + 80;
        svg += `<text x="${width / 2}" y="${titleY}" text-anchor="middle" font-size="13" font-weight="bold" fill="#333">${xLabel}</text>`;
    }
    
    const yLabel = get(config, 'options.scales.y.title.text') || get(config, 'options.scales.yAxes.0.scaleLabel.labelString', '');
    if (yLabel) svg += `<text transform="rotate(-90)" x="${-height / 2}" y="25" text-anchor="middle" font-size="13" font-weight="bold" fill="#333">${yLabel}</text>`;

    const chartBounds = calculateActualChartBounds(config, padding, chartHeight, chartWidth, labels);

    svg += generateLegendSVG(config, width, height, chartBounds, baseLegendLayout);
    svg += '</svg>';
    return svg;
}

/**
 * Generates an SVG for a Pie Chart with enhanced color support.
 */
function generatePieChartSVG(config) {
    const baseLegendLayout = calculateLegendLayout(config, 700, 500);
    
    let width = 700, height = 500;
    if (baseLegendLayout.position === 'right' || baseLegendLayout.position === 'left') {
        width += baseLegendLayout.actualWidth;
    }
    if (baseLegendLayout.position === 'top' || baseLegendLayout.position === 'bottom') {
        height += baseLegendLayout.actualHeight;
    }

    const data = get(config, 'data.datasets.0.data', []);
    if (data.length === 0) return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="${width/2}" y="${height/2}" text-anchor="middle">No data</text></svg>`;

    let basePadding = { top: 80, right: 40, bottom: 40, left: 40 };
    
    const padding = adjustPaddingForLegend(basePadding, baseLegendLayout);

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const chartBounds = {
        left: padding.left,
        top: padding.top,
        right: padding.left + chartWidth,
        bottom: padding.top + chartHeight,
        actualLeft: padding.left,
        actualRight: padding.left + chartWidth,
        actualBottom: padding.top + chartHeight,
        width: chartWidth,
        height: chartHeight
    };

    const radius = Math.min(chartWidth, chartHeight) / 2 * 0.9;
    const cx = chartBounds.left + chartWidth / 2;
    const cy = chartBounds.top + chartHeight / 2;
    const total = data.reduce((a, b) => a + b, 0);

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: Arial, sans-serif;">`;
    svg += `<rect width="100%" height="100%" fill="white"/>`;
    svg += generateTitleSVG(config.options, width);

    // Draw pie slices
    let startAngle = -Math.PI / 2;
    for (let i = 0; i < data.length; i++) {
        const sliceAngle = (data[i] / total) * 2 * Math.PI;
        if (sliceAngle === 0) continue;

        const x1 = cx + radius * Math.cos(startAngle);
        const y1 = cy + radius * Math.sin(startAngle);
        const x2 = cx + radius * Math.cos(startAngle + sliceAngle);
        const y2 = cy + radius * Math.sin(startAngle + sliceAngle);
        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

        const pathData = [
            `M ${cx},${cy}`,
            `L ${x1},${y1}`,
            `A ${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2}`,
            'Z'
        ].join(' ');

        const color = getChartColor(config.data.datasets[0], i, 0, false, true);
        svg += `<path d="${pathData}" fill="${color}" />`;

        // Add slice labels
        if (data[i] > 0) {
            const labelAngle = startAngle + sliceAngle / 2;
            const labelRadius = radius * 0.7;
            const labelX = cx + labelRadius * Math.cos(labelAngle);
            const labelY = cy + labelRadius * Math.sin(labelAngle);
            const percentage = ((data[i] / total) * 100).toFixed(1);

            if (data[i] / total > 0.02) {
                svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="bold" fill="white">${data[i]}</text>`;
                svg += `<text x="${labelX}" y="${labelY + 12}" text-anchor="middle" font-size="9" fill="white">(${percentage}%)</text>`;
            }
        }

        startAngle += sliceAngle;
    }

    svg += generateLegendSVG(config, width, height, chartBounds, baseLegendLayout);
    svg += '</svg>';
    return svg;
}

/**
 * Main Lambda handler function.
 */
export const handler = async (event) => {
    try {
        console.log("Received event:", JSON.stringify(event, null, 2));
        const body = event.queryStringParameters;
        const config = JSON.parse(body.jsonData);

        const chartType = get(config, 'type', '').toLowerCase();
        let svgContent = '';

        switch (chartType) {
            case 'pie':
                svgContent = generatePieChartSVG(config);
                break;
            case 'bar':
                svgContent = generateBarChartSVG(config);
                break;
            case 'line':
                svgContent = generateLineChartSVG(config);
                break;
            default:
                throw new Error(`Unsupported chart type: ${chartType}`);
        }

        const objectKey = `charts/chart-${uuidv4()}.svg`;
        const putCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: objectKey,
            Body: svgContent,
            ContentType: 'image/svg+xml',
        });

        await s3Client.send(putCommand);
        
        const getCommand = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: objectKey });
        const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
        
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
        };
    } catch (error) {
        console.error("Error generating chart:", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Failed to generate chart.", error: error.message })
        };
    }
};