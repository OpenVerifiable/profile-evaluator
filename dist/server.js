import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import Handlebars from 'handlebars';
import Fastify from 'fastify';
import { Evaluator } from './evaluator.js';
import { FormulaRunner } from './utils/jsonFormula.js';
const server = Fastify({ logger: true });
const evaluator = new Evaluator();
server.post('/evaluate', async (request, reply) => {
    try {
        const { jsonData, profilePath, evalExpression, htmlTemplate, outputFormat, outputDir } = request.body;
        // Validate body
        if (!jsonData) {
            return reply.status(400).send({ error: '`jsonData` is required.' });
        }
        if (!profilePath && !evalExpression) {
            return reply.status(400).send({ error: 'Either `profilePath` or `evalExpression` must be provided.' });
        }
        if (profilePath && evalExpression) {
            return reply.status(400).send({ error: 'Cannot use both `profilePath` and `evalExpression` together.' });
        }
        let result;
        // Evaluate a JSON Formula expression
        if (evalExpression) {
            const formulaRunner = new FormulaRunner();
            server.log.info(`Evaluating expression: ${evalExpression}`);
            result = formulaRunner.run(evalExpression, jsonData);
        }
        else if (profilePath) {
            // Evaluate against a profile file
            if (!fs.existsSync(profilePath)) {
                return reply.status(400).send({ error: `Profile not found: ${profilePath}` });
            }
            server.log.info(`Loading profile at: ${profilePath}`);
            await evaluator.loadProfile(profilePath);
            result = evaluator.evaluate(jsonData, profilePath);
        }
        // Output responses
        // HTML with template
        if (outputFormat === 'html') {
            if (!htmlTemplate) {
                return reply.status(400).send({ error: '`htmlTemplate` required for HTML output.' });
            }
            if (!fs.existsSync(htmlTemplate)) {
                return reply.status(400).send({ error: `Template file not found: ${htmlTemplate}` });
            }
            const templateStr = fs.readFileSync(htmlTemplate, 'utf-8');
            const template = Handlebars.compile(templateStr);
            const html = template(result);
            // Save to disk if requested
            if (outputDir) {
                fs.mkdirSync(outputDir, { recursive: true });
                const outputPath = path.join(outputDir, `report.html`);
                fs.writeFileSync(outputPath, html);
                return reply.send({ reportPath: outputPath });
            }
            reply.header('Content-Type', 'text/html').send(html);
            return;
        }
        // YAML output
        if (outputFormat === 'yaml') {
            const yamlStr = YAML.stringify(result, null, { collectionStyle: 'block' });
            return reply.send({ result: yamlStr });
        }
        // Default to JSON
        return reply.send({ result });
    }
    catch (err) {
        server.log.error(err);
        return reply.status(500).send({ error: err.message });
    }
});
// Health check
server.get('/health', async (_, reply) => reply.send({ status: 'ok' }));
// Start server
const port = Number(process.env.PORT || 4000);
server.listen({ port }, (err, address) => {
    if (err) {
        server.log.error(err);
        process.exit(1);
    }
    server.log.info(`Server listening at ${address}`);
});
