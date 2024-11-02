const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Analyzes text content using the FC API backend.
 * @param {string} textContent - Input text to analyze
 * @returns {Promise<Object|null>} API response containing analysis results or null if request fails
 */
async function analyzeContent(textContent) {
    const url = "http://fc-api.hypernym.ai/analyze_sync";
    const apiKey = "fkd8493jg7392bduw";
    
    // Prepare request payload
    const payload = {
        essay_text: textContent,
        message_history: "" // Empty string as we're only handling direct text input
    };
    
    const headers = {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
    };
    
    console.log("Sending text for analysis...");
    
    try {
        // Make POST request
        const response = await axios.post(url, payload, { headers });
        return response.data;
    } catch (error) {
        if (error.response) {
            console.error(`API request failed with status ${error.response.status}`);
            console.error(error.response.data);
        } else if (error.request) {
            console.error("No response received from the server");
        } else {
            console.error(`Error making API request: ${error.message}`);
        }
        return null;
    }
}

async function main() {
    // Get command line arguments
    const args = process.argv.slice(2);
    const inputFile = args[0];
    const outputFile = args.includes('--output') 
        ? args[args.indexOf('--output') + 1] 
        : null;

    if (!inputFile) {
        console.error('Please provide an input file path');
        process.exit(1);
    }

    try {
        // Simulate the RuntimeError from Python version
        throw new Error("Annon was not working so we using dummy text.");
    } catch {
        try {
            // Read input text file
            const textContent = await fs.readFile(inputFile, 'utf-8');
            
            if (!textContent.trim()) {
                console.error("Error: Input file is empty");
                return;
            }

            // Analyze the content
            const result = await analyzeContent(textContent);
            
            if (result) {
                // If output file is specified, write to file
                if (outputFile) {
                    await fs.writeFile(outputFile, JSON.stringify(result, null, 2));
                    console.log(`Results written to ${outputFile}`);
                } else {
                    // Otherwise print to console
                    console.log(JSON.stringify(result, null, 2));
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error(`Error: Input file '${inputFile}' not found`);
            } else if (error instanceof TypeError && error.message.includes('decode')) {
                console.error(`Error: Unable to read file '${inputFile}'. Please ensure it's a valid text file.`);
            } else {
                console.error(`Error: ${error.message}`);
            }
        }
    }
}

// Check if being run directly (not imported as a module)
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    analyzeContent,
    main
};