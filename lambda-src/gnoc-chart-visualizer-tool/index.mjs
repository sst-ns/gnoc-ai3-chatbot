import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.region || 'us-west-2'
});

const BUCKET_NAME = process.env.bucket_name || 'gnocai3data';
const PRESIGNED_URL_EXPIRY = 3600; 

export const handler = async (event) => {
    console.log(`Event: ${JSON.stringify(event)}`);
    try {
        // Parse the input JSON
        const body= event.queryStringParameters
        const chartConfig = JSON.parse(body.jsonData)
        console.log(`Chart configuration: ${JSON.stringify(chartConfig)}`);
        // Validate input
        if (!chartConfig || !chartConfig.type || !chartConfig.data) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Invalid chart configuration. Expected format: { type: "pie|bar|line", data: { labels: [], datasets: [] } }'
                })
            };
        }

        // Generate chart SVG based on type
        let svgContent;
        
        switch (chartConfig.type.toLowerCase()) {
            case 'pie':
                svgContent = generatePieChartSVG(chartConfig);
                break;
            case 'bar':
                svgContent = generateBarChartSVG(chartConfig);
                break;
            case 'line':
                svgContent = generateLineChartSVG(chartConfig);
                break;
            default:
                throw new Error(`Unsupported chart type: ${chartConfig.type}`);
        }

        // Generate unique filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const uniqueId = uuidv4().substring(0, 8);
        const filename = `charts/${chartConfig.type}-${timestamp}-${uniqueId}.svg`;

        // Upload SVG to S3
        const uploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: filename,
            Body: svgContent,
            ContentType: 'image/svg+xml',
            Metadata: {
                'chart-type': chartConfig.type,
                'generated-at': new Date().toISOString(),
                'chart-title': chartConfig.options?.title?.text || 'Untitled Chart'
            }
        });

        console.log(`Uploading chart to S3: ${filename}`);
        await s3Client.send(uploadCommand);

        // Generate presigned URL
        const getObjectCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: filename
        });

        const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, { 
            expiresIn: PRESIGNED_URL_EXPIRY 
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                presignedUrl: presignedUrl,
                filename: filename
            })
        };

    } catch (error) {
        console.error('Error generating chart:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Failed to generate chart image',
                details: error.message
            })
        };
    }
};

// Enhanced SVG Chart Generation Functions
function generatePieChartSVG(config) {
    const { data, options } = config;
    const { labels, datasets } = data;
    const dataset = datasets[0];
    
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 150;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs><style>.chart-title { font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #333; } .chart-label { font-family: Arial, sans-serif; font-size: 14px; fill: #333; } .legend-text { font-family: Arial, sans-serif; font-size: 12px; fill: #666; }</style></defs>`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;
    
    // Add title
    if (options?.title?.display) {
        svg += `<text x="${centerX}" y="40" text-anchor="middle" class="chart-title">${options.title.text}</text>`;
    }
    
    // Calculate angles and draw pie slices
    const total = dataset.data.reduce((sum, value) => sum + value, 0);
    let currentAngle = -Math.PI / 2; // Start from top
    
    dataset.data.forEach((value, index) => {
        const sliceAngle = (value / total) * 2 * Math.PI;
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;
        
        const x1 = centerX + Math.cos(startAngle) * radius;
        const y1 = centerY + Math.sin(startAngle) * radius;
        const x2 = centerX + Math.cos(endAngle) * radius;
        const y2 = centerY + Math.sin(endAngle) * radius;
        
        const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
        const color = dataset.backgroundColor?.[index] || getDefaultColor(index);
        
        svg += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${color}" stroke="white" stroke-width="2"/>`;
        
        // Add percentage labels
        const labelAngle = startAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
        const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
        const percentage = ((value / total) * 100).toFixed(1);
        
        svg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" class="chart-label">${percentage}%</text>`;
        
        currentAngle = endAngle;
    });
    
    // Add legend
    const legendX = 50;
    const legendY = height - 150;
    labels.forEach((label, index) => {
        const color = dataset.backgroundColor?.[index] || getDefaultColor(index);
        const y = legendY + index * 20;
        svg += `<rect x="${legendX}" y="${y - 10}" width="15" height="15" fill="${color}"/>`;
        svg += `<text x="${legendX + 25}" y="${y}" class="legend-text">${label}</text>`;
    });
    
    svg += '</svg>';
    return svg;
}

function generateBarChartSVG(config) {
    const { data, options } = config;
    const { labels, datasets } = data;
    
    const width = 800;
    const height = 600;
    const margin = 80;
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin - 60;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs><style>.chart-title { font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #333; } .axis-label { font-family: Arial, sans-serif; font-size: 12px; fill: #666; } .axis-line { stroke: #333; stroke-width: 2; } .grid-line { stroke: #e0e0e0; stroke-width: 1; }</style></defs>`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;
    
    // Add title
    if (options?.title?.display) {
        svg += `<text x="${width / 2}" y="40" text-anchor="middle" class="chart-title">${options.title.text}</text>`;
    }
    
    // Find max value for scaling
    const maxValue = Math.max(...datasets.flatMap(d => d.data));
    const yScale = chartHeight / maxValue;
    
    // Add grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = margin + (chartHeight / gridLines) * i;
        svg += `<line x1="${margin}" y1="${y}" x2="${margin + chartWidth}" y2="${y}" class="grid-line"/>`;
        const value = maxValue - (maxValue / gridLines) * i;
        svg += `<text x="${margin - 10}" y="${y + 5}" text-anchor="end" class="axis-label">${Math.round(value)}</text>`;
    }
    
    // Calculate bar dimensions
    const barWidth = chartWidth / labels.length / datasets.length - 10;
    const groupWidth = chartWidth / labels.length;
    
    // Draw axes
    svg += `<line x1="${margin}" y1="${margin}" x2="${margin}" y2="${margin + chartHeight}" class="axis-line"/>`;
    svg += `<line x1="${margin}" y1="${margin + chartHeight}" x2="${margin + chartWidth}" y2="${margin + chartHeight}" class="axis-line"/>`;
    
    // Draw bars
    datasets.forEach((dataset, datasetIndex) => {
        dataset.data.forEach((value, labelIndex) => {
            const barHeight = value * yScale;
            const x = margin + labelIndex * groupWidth + datasetIndex * barWidth + 5;
            const y = margin + chartHeight - barHeight;
            
            const color = dataset.backgroundColor?.[labelIndex] || getDefaultColor(datasetIndex);
            svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2"/>`;
            
            // Add value labels on top of bars
            svg += `<text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" class="axis-label">${value}</text>`;
        });
    });
    
    // Draw labels
    labels.forEach((label, index) => {
        const x = margin + index * groupWidth + groupWidth / 2;
        const y = margin + chartHeight + 20;
        svg += `<text x="${x}" y="${y}" text-anchor="middle" class="axis-label">${label}</text>`;
    });
    
    svg += '</svg>';
    return svg;
}

function generateLineChartSVG(config) {
    const { data, options } = config;
    const { labels, datasets } = data;
    
    const width = 800;
    const height = 600;
    const margin = 80;
    const chartWidth = width - 2 * margin;
    const chartHeight = height - 2 * margin - 60;
    
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<defs><style>.chart-title { font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; fill: #333; } .axis-label { font-family: Arial, sans-serif; font-size: 12px; fill: #666; } .axis-line { stroke: #333; stroke-width: 2; } .grid-line { stroke: #e0e0e0; stroke-width: 1; }</style></defs>`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;
    
    // Add title
    if (options?.title?.display) {
        svg += `<text x="${width / 2}" y="40" text-anchor="middle" class="chart-title">${options.title.text}</text>`;
    }
    
    // Find max value for scaling
    const maxValue = Math.max(...datasets.flatMap(d => d.data));
    const yScale = chartHeight / maxValue;
    const xScale = chartWidth / (labels.length - 1);
    
    // Add grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const y = margin + (chartHeight / gridLines) * i;
        svg += `<line x1="${margin}" y1="${y}" x2="${margin + chartWidth}" y2="${y}" class="grid-line"/>`;
        const value = maxValue - (maxValue / gridLines) * i;
        svg += `<text x="${margin - 10}" y="${y + 5}" text-anchor="end" class="axis-label">${Math.round(value)}</text>`;
    }
    
    // Draw axes
    svg += `<line x1="${margin}" y1="${margin}" x2="${margin}" y2="${margin + chartHeight}" class="axis-line"/>`;
    svg += `<line x1="${margin}" y1="${margin + chartHeight}" x2="${margin + chartWidth}" y2="${margin + chartHeight}" class="axis-line"/>`;
    
    // Draw lines
    datasets.forEach((dataset, datasetIndex) => {
        const color = dataset.borderColor || getDefaultColor(datasetIndex);
        
        // Create path for line
        let pathData = '';
        dataset.data.forEach((value, index) => {
            const x = margin + index * xScale;
            const y = margin + chartHeight - value * yScale;
            
            if (index === 0) {
                pathData += `M ${x} ${y}`;
            } else {
                pathData += ` L ${x} ${y}`;
            }
        });
        
        svg += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="3"/>`;
        
        // Draw points
        dataset.data.forEach((value, index) => {
            const x = margin + index * xScale;
            const y = margin + chartHeight - value * yScale;
            svg += `<circle cx="${x}" cy="${y}" r="4" fill="${color}" stroke="white" stroke-width="2"/>`;
        });
    });
    
    // Draw labels
    labels.forEach((label, index) => {
        const x = margin + index * xScale;
        const y = margin + chartHeight + 20;
        svg += `<text x="${x}" y="${y}" text-anchor="middle" class="axis-label">${label}</text>`;
    });
    
    svg += '</svg>';
    return svg;
}

// Helper function
function getDefaultColor(index) {
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
    return colors[index % colors.length];
}