const fs = require('fs');

let file = 'armageddon-core/src/core/evidence-generator.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("        } catch (_e) {", "        } catch {");
fs.writeFileSync(file, content);

file = 'armageddon-core/src/core/reporter.ts';
content = fs.readFileSync(file, 'utf8');
content = content.replace(/const \[dbResult, _broadcastResult\] = await Promise\.all\(\[/g, "const [dbResult] = await Promise.all([");
fs.writeFileSync(file, content);
