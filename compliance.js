const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class ComplianceAnalyzer {
    constructor(options = {}) {
        this.outputDir = options.outputDir || './output';
        this.apiKey = options.apiKey || "fkd8493jg7392bduw";
        this.apiUrl = options.apiUrl || "http://fc-api.hypernym.ai/analyze_sync";
        this.baseGithubUrl = options.baseGithubUrl || 'https://github.com/anon-dot-com/actions/blob/main/src/app';
        this.results = {
            timestamp: new Date().toISOString(),
            websiteInfo: null,
            semanticAnalysis: null,
            userDataAnalysis: null,
            actionSpace: null
        };
    }

    async initialize() {
        await fs.mkdir(this.outputDir, { recursive: true });
    }

    async saveResults() {
        const outputPath = path.join(this.outputDir, 'compliance_analysis.json');
        await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2));
        return outputPath;
    }

    async extractWebsiteInfo(websiteOrBrand) {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        try {
            const mainSearchQuery = encodeURIComponent(websiteOrBrand);
            await page.goto(`https://www.google.com/search?q=${mainSearchQuery}`);
            
            const firstResult = await page.waitForSelector('div.g a', { timeout: 5000 });
            const mainWebsiteUrl = await firstResult.getAttribute('href');
            
            await page.goto(mainWebsiteUrl);
            
            const mainMetadata = await page.evaluate(() => ({
                title: document.title || null,
                description: document.querySelector('meta[name="description"]')?.content || null,
                keywords: document.querySelector('meta[name="keywords"]')?.content || null,
                author: document.querySelector('meta[name="author"]')?.content || null
            }));

            const tosSearchQuery = encodeURIComponent(`${websiteOrBrand} terms of service OR terms and conditions`);
            await page.goto(`https://www.google.com/search?q=${tosSearchQuery}`);
            
            const tosResult = await page.waitForSelector('div.g a', { timeout: 5000 });
            const tosUrl = await tosResult.getAttribute('href');
            
            await page.goto(tosUrl);
            
            const tosContent = await page.evaluate(() => {
                return document.body.innerText.replace(/\s+/g, ' ').trim();
            });

            const messageHistory = await this.getMessageHistory();

            this.results.websiteInfo = {
                mainWebsite: {
                    url: mainWebsiteUrl,
                    metadata: mainMetadata,
                    extractedAt: new Date().toISOString()
                },
                termsOfService: {
                    url: tosUrl,
                    plainText: tosContent,
                    extractedAt: new Date().toISOString()
                },
                messageHistory
            };
            
            return this.results.websiteInfo;
        } finally {
            await browser.close();
        }
    }

    async getMessageHistory() {
        try {
            return await fs.readFile('allMessages.txt', 'utf8');
        } catch {
            try {
                return await fs.readFile('dummyLinkedIn.txt', 'utf8');
            } catch {
                console.warn('No message history found');
                return '';
            }
        }
    }

    async semanticCompression(inputData) {
        const payload = {
            essay_text: inputData.termsOfService.plainText,
            message_history: inputData.messageHistory || ""
        };

        try {
            const response = await axios.post(this.apiUrl, payload, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": this.apiKey
                }
            });

            this.results.semanticAnalysis = response.data;
            return response.data;
        } catch (error) {
            console.error('Semantic compression failed:', error.message);
            return null;
        }
    }

    async userDataCompression(textContent) {
        try {
            const response = await axios.post(this.apiUrl, {
                essay_text: textContent,
                message_history: ""
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": this.apiKey
                }
            });

            this.results.userDataAnalysis = response.data;
            return response.data;
        } catch (error) {
            console.error('User data compression failed:', error.message);
            return null;
        }
    }

    async extractActionSpace(provider) {
        try {
            const githubUrl = `${this.baseGithubUrl}/${provider}.ts`;
            const rawUrl = githubUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
            
            const response = await axios.get(rawUrl);
            const content = response.data;

            const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
            
            const patterns = {
                exported_const: /export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
                async_function: /async\s+(?:function\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g
            };

            const functions = new Set();
            
            for (const pattern of Object.values(patterns)) {
                let match;
                while ((match = pattern.exec(cleanContent)) !== null) {
                    functions.add(match[1]);
                }
            }

            this.results.actionSpace = {
                actionSpace: Array.from(functions).sort()
            };
            
            return this.results.actionSpace;
        } catch (error) {
            console.error('Action space extraction failed:', error.message);
            return null;
        }
    }

    async analyze(websiteOrBrand) {
        await this.initialize();
        
        try {
            console.log('Extracting website information...');
            await this.extractWebsiteInfo(websiteOrBrand);

            console.log('Performing semantic analysis...');
            await this.semanticCompression(this.results.websiteInfo);

            console.log('Analyzing user data...');
            await this.userDataCompression(this.results.websiteInfo.termsOfService.plainText);

            console.log('Extracting action space...');
            await this.extractActionSpace(websiteOrBrand);

            const outputPath = await this.saveResults();
            console.log(`Analysis results saved to: ${outputPath}`);

            return this.results;
        } catch (error) {
            console.error('Analysis failed:', error);
            throw error;
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Usage: node compliance.js <website-or-brand> <provider> [options]

Options:
  --output-dir <dir>    Output directory for results (default: ./output)
  --api-key <key>       Custom API key for analysis
  --api-url <url>       Custom API URL for analysis
  --github-url <url>    Custom GitHub base URL for action space extraction
  --help               Show this help message
        `);
        process.exit(0);
    }

    const websiteOrBrand = args[0];
    const provider = args[1];
    
    const options = {
        outputDir: args.includes('--output-dir') ? args[args.indexOf('--output-dir') + 1] : './output',
        apiKey: args.includes('--api-key') ? args[args.indexOf('--api-key') + 1] : undefined,
        apiUrl: args.includes('--api-url') ? args[args.indexOf('--api-url') + 1] : undefined,
        baseGithubUrl: args.includes('--github-url') ? args[args.indexOf('--github-url') + 1] : undefined
    };

    const analyzer = new ComplianceAnalyzer(options);
    
    try {
        await analyzer.analyze(websiteOrBrand);
        console.log(analyzer.results)
        result = await callOpenAI(analyzer.results)
        console.log(result)
        console.log('Analysis completed successfully');
    } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
    }
}
async function callOpenAI(data) {
    const myData = data
    
    try {
        console.log(myData)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer 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`
        },
        
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
                "role": "user",
                "content":
                 JSON.stringify(myData)    }
              
            
            ,{
                "role": "system",
                "content":
                "You are an AI Compliance Officer analyzing service provider Terms of Service to identify key risk factors and provide neutral risk assessment using available evidence. You aim to demonstrate legitimate user behavior while flagging any concerning patterns.\n\n1. SERVICE CONTEXT:\nParse service description to understand:\n- Core service offering\n- Target user base\n- Standard usage patterns\n- Business model\n\n2. TERMS OF SERVICE ANALYSIS: \nExtract Key Risk Factors:\n- Usage restrictions and limits \n- Prohibited behaviors \n- User verification requirements \n- Automatic access restrictions \n- Resale/commercial use policies \n- Rate limiting specifications \n\n3. RISK LEVEL ASSESSMENT:\nCategorize service risk (L/M/H) based on:\n- Financial impact\n- Data sensitivity\n- Automation potential\n- Regulatory requirements\n- Market impact\n\n4. EVIDENCE EVALUATION:\nAnalyze available trust signals based on service context:\n- Financial history (ACH, crypto, cards)\n- User behavior (messages, usage patterns)\n- Identity verification (email, phone, social)\n- Platform engagement metrics\n- Cross-service reputation\n\nTRUST SCORING:\nExceptional (90-95): Multiple strong verifications, 6+ months history\nStrong (80-89): Single strong verification, 3-6 months history\nStandard (70-79): Basic verification, 1-3 months history\nBasic (60-69): Minimal verification, <1 month history\nCautionary (40-59): Incomplete verification, unusual patterns \nHigh Risk (<40): No verification, concerning patterns\n\nANALYTICS FORMAT:\n{Industry/Region/Engagement}\nIndustry: Tech, Finance, Creative, Student, Retail, Gaming\nRegion: NA-W, NA-E, EU, APAC, LATAM\nEngagement: Active, New, Return, Power\n\nEVIDENCE TAGS:\nFormat: {SOURCE-HISTORY-TYPE}\n\nSources:\nVBA - Verified Bank Account\nKYC - Know Your Customer\nPLT - Platform History\nPRO - Professional Profile\nCOM - Commerce History\n\nHistory:\n1YR/3YR/5YR - Years of history\nNEW - New account\nPUR - Purchase patterns\nACT - Activity patterns\n\nType:\nPRO - Professional\nRET - Retail\nSTU - Student\nBIZ - Business\nENT - Enterprise\n\nOUTPUT FORMAT:\n\n1. SHORT TRUST ARGUMENT:\n%This verified user's agent is provided by Anon [Risk: {L/M/H} | Trust: {score}]. {Time} History. {Industry/Region/Engagement} {EVIDENCE-TAGS} Learn more: hypernym.ai/t/{hash}\n\nExample:\n\n1. E-commerce:\n%This verified user's agent is provided by Anon [Risk: L | Trust: 82]. 3yr History. {Tech/NA-W/Active} {VBA-PUR-PRO} Learn more: hypernym.ai/t/7d8f9g\n",
                
              }
          ],
          temperature: 0.7
        })
      });
  
      const data = await response.json();
      console.log('Response:', data);
      return data;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
  
if (require.main === module) {
    main();
}

module.exports = ComplianceAnalyzer;