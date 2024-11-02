const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Analyzes both terms of service and message history using the FC API backend.
 * @param {Object} inputJson - Input JSON containing termsOfService and messageHistory fields
 * @returns {Promise<Object|null>} API response containing analysis results or null if request fails
 */
async function analyzeContent(inputJson) {
    const url = "http://fc-api.hypernym.ai/analyze_sync";
    const apiKey = "fkd8493jg7392bduw";

    // Check for required fields
    if (!inputJson.termsOfService) {
        console.error("Error: termsOfService field not found in input JSON");
        return null;
    }

    // Prepare request payload
    const payload = {
        essay_text: inputJson.termsOfService.plainText,
        message_history: inputJson.messageHistory || "" // Use empty string if no messages
    };

    const headers = {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
    };

    console.log(payload);

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

/**
 * Main function to process command line arguments and execute the analysis
 */
async function main() {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: node semantic_compression.js <input_file> [--output <output_file>]');
        process.exit(1);
    }

    const inputFile = args[0];
    const outputIndex = args.indexOf('--output');
    const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : null;

    try {
        // Read input JSON file
        const inputData = await fs.readFile(inputFile, 'utf8');
        const inputJson = JSON.parse(inputData);

        // Analyze the content
        const result = await analyzeContent(inputJson);

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
        } else if (error instanceof SyntaxError) {
            console.error(`Error: Invalid JSON in input file '${inputFile}'`);
        } else {
            console.error(`Error: ${error.message}`);
        }
        process.exit(1);
    }
}

// Run the program
if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { analyzeContent };