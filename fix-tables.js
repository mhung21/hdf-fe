const fs = require('fs');
const path = require('path');

function findHtmlFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) { 
            results = results.concat(findHtmlFiles(fullPath));
        } else if (file.endsWith('.html')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = findHtmlFiles('./src/app/pages');

let modifiedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    // 1. Process <thead> blocks
    // Note: there can be multiple thead blocks
    let theadRegex = /<thead([^>]*)>([\s\S]*?)<\/thead>/gi;
    content = content.replace(theadRegex, (match, theadAttr, theadInner) => {
        // Add whitespace-nowrap to <tr> inside thead
        let newInner = theadInner.replace(/<tr([^>]*)>/gi, (trMatch, trAttr) => {
            if (!trAttr.includes('class=')) {
                return `<tr${trAttr} class="whitespace-nowrap">`;
            } else if (!trAttr.includes('whitespace-nowrap')) {
                return `<tr${trAttr.replace(/class=["']([^"']*)["']/, 'class="$1 whitespace-nowrap"')}>`;
            }
            return trMatch;
        });

        // Add min-w-32 to <th> inside thead, or convert w-* to min-w-*
        newInner = newInner.replace(/<th([^>]*)>/gi, (thMatch, thAttr) => {
            if (!thAttr.includes('class=')) {
                return `<th${thAttr} class="min-w-32">`;
            } else {
                let newAttr = thAttr.replace(/class=["']([^"']*)["']/, (attrMatch, classVal) => {
                    let classes = classVal.split(' ');
                    let hasMinW = false;
                    classes = classes.map(cls => {
                        if (cls.startsWith('min-w-')) {
                            hasMinW = true;
                            return cls;
                        }
                        if (cls.startsWith('w-') && cls !== 'w-full') {
                            hasMinW = true;
                            return 'min-w-' + cls.substring(2);
                        }
                        if (cls.startsWith('max-w-')) {
                            return ''; // Remove max-w to let it grow
                        }
                        return cls;
                    }).filter(Boolean);
                    
                    if (!hasMinW) {
                        classes.push('min-w-32');
                    }
                    return `class="${classes.join(' ')}"`;
                });
                return `<th${newAttr}>`;
            }
        });

        return `<thead${theadAttr}>${newInner}</thead>`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
        modifiedFiles++;
        console.log('Modified:', file);
    }
});

console.log('Modified HTML files:', modifiedFiles);
