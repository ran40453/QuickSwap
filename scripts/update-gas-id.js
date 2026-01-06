import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const indexPath = path.join(rootDir, 'docs', 'index.html');

function getLatestDeploymentId() {
    try {
        const output = execSync('clasp deployments', { encoding: 'utf8', cwd: rootDir });
        const lines = output.split('\n');

        // 找到所有部署 ID 和版本
        // 格式通常為: - [ID] @[Version] - [Description]
        const deployments = [];
        for (const line of lines) {
            const match = line.match(/^\s*-\s*([a-zA-Z0-9\-_]+)\s+@(\d+|HEAD)/);
            if (match) {
                deployments.push({
                    id: match[1],
                    version: match[2] === 'HEAD' ? -1 : parseInt(match[2], 10)
                });
            }
        }

        if (deployments.length === 0) {
            throw new Error('找不到任何部署 ID');
        }

        // 排序，取得最新的版本（排除 HEAD，除非只有 HEAD）
        const versionedDeployments = deployments.filter(d => d.version !== -1);
        if (versionedDeployments.length > 0) {
            versionedDeployments.sort((a, b) => b.version - a.version);
            return versionedDeployments[0].id;
        }

        return deployments[0].id; // 如果只有 HEAD
    } catch (error) {
        console.error('執行 clasp deployments 出錯:', error.message);
        process.exit(1);
    }
}

function updateIndexHtml(deploymentId) {
    const newSrc = `https://script.google.com/macros/s/${deploymentId}/exec`;
    let content = '';

    if (fs.existsSync(indexPath)) {
        content = fs.readFileSync(indexPath, 'utf8');
    }

    if (!content || content.trim() === '') {
        // 如果檔案是空的，建立一個新的模板
        content = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>QuickSwap</title>
    <style>
        body, html { 
            margin: 0; 
            padding: 0; 
            height: 100%; 
            width: 100%;
            overflow: hidden; 
            background-color: #f0f2f5;
        }
        iframe { 
            width: 100%; 
            height: 100%; 
            border: none; 
            position: absolute;
            top: 0;
            left: 0;
        }
    </style>
</head>
<body>
    <iframe src="${newSrc}" allow="clipboard-read; clipboard-write"></iframe>
</body>
</html>`;
        console.log('建立全新的 docs/index.html');
    } else {
        // 如果檔案已有內容，更新 iframe src
        const iframeRegex = /<iframe[^>]*src="([^"]*)"[^>]*>/i;
        if (iframeRegex.test(content)) {
            content = content.replace(iframeRegex, (match) => {
                return match.replace(/src="[^"]*"/, `src="${newSrc}"`);
            });
            console.log('更新現有的 iframe src');
        } else {
            // 如果有內容但沒 iframe，則在 body 插入
            if (content.includes('</body>')) {
                content = content.replace('</body>', `    <iframe src="${newSrc}" allow="clipboard-read; clipboard-write"></iframe>\n</body>`);
                console.log('插入新的 iframe 到現有 HTML');
            } else {
                console.warn('HTML 結構異常，無法自動插入 iframe');
                return;
            }
        }
    }

    fs.writeFileSync(indexPath, content, 'utf8');
    console.log(`成功更新 Deployment ID: ${deploymentId}`);
}

const id = getLatestDeploymentId();
updateIndexHtml(id);
