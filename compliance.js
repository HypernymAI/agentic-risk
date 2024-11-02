const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class PipelineOrchestrator {
    constructor(provider) {
        this.provider = provider;
        this.tempDir = path.join(__dirname, 'temp');
        this.results = {};
    }

    async init() {
        // Create temp directory if it doesn't exist
        await fs.mkdir(this.tempDir, { recursive: true });
    }

    async runFirstPage() {
        console.log('Running firstPage.js...');
        try {
            const outputPath = path.join(this.tempDir, 'firstPage_output.json');
            const output = execSync(`node firstPage.js ${this.provider}`, { encoding: 'utf8' });
            await fs.writeFile(outputPath, output);
            this.results.firstPage = JSON.parse(output);
            return outputPath;
        } catch (error) {
            throw new Error(`Error in firstPage.js: ${error.message}`);
        }
    }

    async runSemanticCompression(inputPath) {
        console.log('Running semantic_compression.js...');
        try {
            const outputPath = path.join(this.tempDir, 'semantic_output.json');
            execSync(`node semantic_compression.js ${inputPath} --output ${outputPath}`, { encoding: 'utf8' });
            const output = await fs.readFile(outputPath, 'utf8');
            this.results.semanticCompression = JSON.parse(output);
            return outputPath;
        } catch (error) {
            throw new Error(`Error in semantic_compression.js: ${error.message}`);
        }
    }

    async runActionSpaceExtractor() {
        console.log('Running actionSpaceExtractor.js...');
        try {
            const outputPath = path.join(this.tempDir, 'action_space_output.json');
            const extractor = new (require('./actionSpaceExtractor'))();
            const result = await extractor.extractFunctions(this.provider);
            await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
            this.results.actionSpace = result;
            return outputPath;
        } catch (error) {
            throw new Error(`Error in actionSpaceExtractor.js: ${error.message}`);
        }
    }

    async runUserDataCompression(inputPath) {
        console.log('Running user_data_compression.js...');
        try {
            const outputPath = path.join(this.tempDir, 'user_data_output.json');
            execSync(`node user_data_compression.js ${inputPath} --output ${outputPath}`, { encoding: 'utf8' });
            const output = await fs.readFile(outputPath, 'utf8');
            this.results.userDataCompression = JSON.parse(output);
            return outputPath;
        } catch (error) {
            throw new Error(`Error in user_data_compression.js: ${error.message}`);
        }
    }

    async mergeResults() {
        return {
            provider: this.provider,
            timestamp: new Date().toISOString(),
            results: {
                firstPage: this.results.firstPage || null,
                semanticCompression: this.results.semanticCompression || null,
                actionSpace: this.results.actionSpace || null,
                userDataCompression: this.results.userDataCompression || null
            }
        };
    }

    async cleanup() {
        try {
            await fs.rm(this.tempDir, { recursive: true });
        } catch (error) {
            console.warn('Warning: Could not clean up temporary files:', error.message);
        }
    }

    async run() {
        try {
            await this.init();

            // Run pipeline steps
            const firstPageOutput = await this.runFirstPage();
            await this.runSemanticCompression(firstPageOutput);
            await this.runActionSpaceExtractor();
            await this.runUserDataCompression(firstPageOutput);

            // Merge results
            const finalResult = await this.mergeResults();

            // Write final output
            const finalOutputPath = path.join(process.cwd(), `${this.provider}_analysis_result.json`);
            await fs.writeFile(finalOutputPath, JSON.stringify(finalResult, null, 2));
            console.log(`Final results written to: ${finalOutputPath}`);

            // Cleanup temporary files
            await this.cleanup();

            return finalResult;
        } catch (error) {
            console.error('Pipeline failed:', error.message);
            await this.cleanup();
            throw error;
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: node pipeline.js <provider>');
        process.exit(1);
    }

    const provider = args[0];
    const pipeline = new PipelineOrchestrator(provider);
    
    try {
        await pipeline.run();
    } catch (error) {
        console.error('Pipeline execution failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = PipelineOrchestrator;