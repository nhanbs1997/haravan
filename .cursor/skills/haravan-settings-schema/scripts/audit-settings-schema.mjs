#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const themeRoot = path.resolve(process.argv[2] || '.');
const schemaPath = path.join(themeRoot, 'config', 'settings_schema.json');
const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target) : [target];
  });
}

if (!fs.existsSync(schemaPath)) {
  console.error(`ERROR missing ${schemaPath}`);
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
} catch (error) {
  console.error(`ERROR invalid JSON: ${error.message}`);
  process.exit(1);
}

if (!Array.isArray(schema)) fail('settings_schema.json top level must be an array');

const allowedTypes = new Set([
  'header', 'paragraph', 'text', 'textarea', 'checkbox', 'color', 'image_picker',
  'select', 'radio', 'link_list', 'collection', 'blog', 'page',
]);
const sectionNames = new Set();
const settingMap = new Map();

for (const [sectionIndex, section] of (Array.isArray(schema) ? schema : []).entries()) {
  if (!section || typeof section !== 'object') {
    fail(`section ${sectionIndex + 1} must be an object`);
    continue;
  }
  if (!section.name || typeof section.name !== 'string') fail(`section ${sectionIndex + 1} missing name`);
  else if (sectionNames.has(section.name)) fail(`duplicate section name: ${section.name}`);
  else sectionNames.add(section.name);
  if (!Array.isArray(section.settings)) {
    fail(`section ${section.name || sectionIndex + 1} missing settings array`);
    continue;
  }
  for (const [settingIndex, setting] of section.settings.entries()) {
    const location = `${section.name || sectionIndex + 1} setting ${settingIndex + 1}`;
    if (!setting || typeof setting !== 'object') {
      fail(`${location} must be an object`);
      continue;
    }
    if (!allowedTypes.has(setting.type)) fail(`${location} unsupported type: ${setting.type}`);
    if (setting.type === 'header' || setting.type === 'paragraph') {
      if (setting.id) fail(`${location} type ${setting.type} must not have id`);
      if (!setting.content) fail(`${location} type ${setting.type} missing content`);
      continue;
    }
    if (!setting.id) {
      fail(`${location} missing id`);
      continue;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(setting.id) || setting.id.includes('.')) fail(`${location} invalid id: ${setting.id}`);
    if (settingMap.has(setting.id)) fail(`duplicate setting id: ${setting.id}`);
    else settingMap.set(setting.id, setting);
    if (!setting.label) fail(`${location} missing label for ${setting.id}`);
    if ((setting.type === 'select' || setting.type === 'radio') && !Array.isArray(setting.options)) {
      fail(`${location} ${setting.type} missing options array`);
    }
  }
}

const liquidFiles = ['layout', 'snippets', 'templates', 'assets']
  .flatMap((folder) => walkFiles(path.join(themeRoot, folder)))
  .filter((file) => file.endsWith('.liquid'));
const sources = liquidFiles.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));

const referencedIds = new Set();
const dynamicReferencedIds = new Set();
for (const { file, text } of sources) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes('{{') && !line.includes('{%')) continue;
    for (const match of line.matchAll(/settings\.([A-Za-z0-9_-]+)|settings\[['"]([A-Za-z0-9_-]+)['"]\]/g)) {
      const id = match[1] || match[2];
      referencedIds.add(id);
      if (!settingMap.has(id)) fail(`${path.relative(themeRoot, file)} references missing setting: ${id}`);
    }
  }

  for (const capture of text.matchAll(/\{%[-]?\s*capture\s+([A-Za-z0-9_]+)\s*[-]?%\}([\s\S]*?)\{%[-]?\s*endcapture\s*[-]?%\}/g)) {
    const variable = capture[1];
    if (!new RegExp(`settings\\[${variable}\\]`).test(text)) continue;
    const template = capture[2].trim();
    if (!/^[A-Za-z0-9_\-{}\s.]+$/.test(template)) continue;
    const pattern = template
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\{\\\{[\s\S]*?\\\}\\\}/g, '[0-9]+');
    const family = new RegExp(`^${pattern}$`);
    for (const id of settingMap.keys()) {
      if (family.test(id)) dynamicReferencedIds.add(id);
    }
  }
}

let annotationCount = 0;
let dynamicAnnotationCount = 0;
for (const { file, text } of sources) {
  for (const tagMatch of text.matchAll(/<[^>]+>/gs)) {
    const tag = tagMatch[0];
    const ids = [...tag.matchAll(/setting-id=/g)].length;
    const types = [...tag.matchAll(/setting-type=/g)].length;
    if (!ids && !types) continue;
    annotationCount += ids;
    if (ids !== 1 || types !== 1) {
      fail(`${path.relative(themeRoot, file)} editor tag must have one setting-id and one setting-type: ${tag.replace(/\s+/g, ' ').slice(0, 180)}`);
      continue;
    }
    const idMatch = tag.match(/setting-id="([^"]+)"/);
    const typeMatch = tag.match(/setting-type="([^"]+)"/);
    if (!idMatch || !typeMatch) {
      fail(`${path.relative(themeRoot, file)} editor attributes must use quoted values`);
      continue;
    }
    const id = idMatch[1];
    const editorType = typeMatch[1];
    if (id.includes('{{') || id.includes('{%')) {
      dynamicAnnotationCount++;
      if (!['text', 'textarea', 'image'].includes(editorType)) fail(`${path.relative(themeRoot, file)} invalid dynamic setting-type: ${editorType}`);
      continue;
    }
    const setting = settingMap.get(id);
    if (!setting) {
      fail(`${path.relative(themeRoot, file)} setting-id not found in schema: ${id}`);
      continue;
    }
    const expectedType = setting.type === 'image_picker' ? 'image' : setting.type;
    if (expectedType !== editorType) {
      fail(`${path.relative(themeRoot, file)} ${id} setting-type ${editorType}; expected ${expectedType}`);
    }
  }
}

const cssFiles = walkFiles(path.join(themeRoot, 'assets')).filter((file) => /\.css(?:\.liquid)?$/.test(file));
for (const file of cssFiles) {
  const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const leak = text.match(/^\s*(?:html\s+)?body\.[A-Za-z0-9_-]+\s+(?:input|textarea|select|label)(?:\b|:|\[)/m);
  if (leak) fail(`${path.relative(themeRoot, file)} bare editor-leaking selector: ${leak[0]}`);
}

for (const id of settingMap.keys()) {
  if (!referencedIds.has(id) && !dynamicReferencedIds.has(id)) warnings.push(`schema setting has no resolved reference: ${id}`);
}

console.log(JSON.stringify({
  themeRoot,
  sections: sectionNames.size,
  settings: settingMap.size,
  liquidFiles: liquidFiles.length,
  staticReferences: referencedIds.size,
  dynamicReferences: dynamicReferencedIds.size,
  annotations: annotationCount,
  dynamicAnnotations: dynamicAnnotationCount,
  errors: errors.length,
  warnings: warnings.length,
}, null, 2));

for (const error of errors) console.error(`ERROR ${error}`);
for (const warning of warnings.slice(0, 25)) console.warn(`WARN ${warning}`);
if (warnings.length > 25) console.warn(`WARN ... ${warnings.length - 25} more warnings`);
process.exitCode = errors.length ? 1 : 0;
