const fs = require('fs');
const path = require('path');

const shopDir = 'c:/Users/Admin/Documents/0/shops/200001200522 - 1001506473 - Giao diện Bs Thùy Dương IVF - nhanbs1997@gmail.com';

// 1. page.cam-nang.liquid
const cnPath = path.join(shopDir, 'templates/page.cam-nang.liquid');
let cnText = fs.readFileSync(cnPath, 'utf8');
cnText = cnText.replace('.cam-nang-clone {', '.cam-nang-clone, .giuseart-nav {');
if (!cnText.includes('.cam-nang-category h2 a {')) {
  cnText = cnText.replace('.cam-nang-category h2 {', '.cam-nang-category h2 a { color: inherit; text-decoration: none; }\n\t.cam-nang-category h2 {');
}
cnText = cnText.replace('<div class="cam-nang-clone">', '<div class="cam-nang-clone giuseart-nav">');
cnText = cnText.replace('<section class="cam-nang-directory"', '<section class="cam-nang-directory giuseart-nav"');

const oldH2 = '<h2>{{ settings[title_key] | default: default_category_title }}</h2>';
const newH2 = `{% assign category_url_key = 'cam_nang_category_' | append: category_index | append: '_url' %}
					{% assign active_cat_url = settings[category_url_key] | default: default_category_url %}
					<h2>{% if active_cat_url != blank %}<a href="{{ active_cat_url }}">{{ settings[title_key] | default: default_category_title }}</a>{% else %}{{ settings[title_key] | default: default_category_title }}{% endif %}</h2>`;
if (cnText.includes(oldH2)) {
  cnText = cnText.replace(oldH2, newH2);
}
fs.writeFileSync(cnPath, cnText, 'utf8');
console.log('page.cam-nang.liquid updated');

// 2. settings_schema.json
const schemaPath = path.join(shopDir, 'config/settings_schema.json');
const schemaData = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
for (const section of schemaData) {
  if (section.name === '17. Trang Cẩm nang' || section.name === '17. Trang Cẩm nang (.giuseart-nav)') {
    section.name = '17. Trang Cẩm nang (.giuseart-nav)';
    for (const setting of section.settings || []) {
      if (setting.type === 'header' && (setting.content === '17. Trang Cẩm nang' || setting.content === '17. Trang Cẩm nang (.giuseart-nav)')) {
        setting.content = '17. Trang Cẩm nang (.giuseart-nav)';
      }
      if (setting.type === 'paragraph' && setting.content && setting.content.includes('mẫu tham chiếu')) {
        setting.content = 'Thiết lập nội dung giao diện 4 danh mục .giuseart-nav giống mẫu tham chiếu GTV SEO (bỏ phần tìm kiếm).';
      }
    }
    const existingIds = new Set((section.settings || []).map(s => s.id).filter(Boolean));
    const newSettings = [];
    for (const s of (section.settings || [])) {
      newSettings.push(s);
      if (s.id === 'cam_nang_category_1_title' && !existingIds.has('cam_nang_category_1_url')) {
        newSettings.push({ type: 'text', id: 'cam_nang_category_1_url', label: 'Link danh mục 1 - URL', default: '/seo/' });
      } else if (s.id === 'cam_nang_category_2_title' && !existingIds.has('cam_nang_category_2_url')) {
        newSettings.push({ type: 'text', id: 'cam_nang_category_2_url', label: 'Link danh mục 2 - URL', default: '/ai-seo/' });
      } else if (s.id === 'cam_nang_category_3_title' && !existingIds.has('cam_nang_category_3_url')) {
        newSettings.push({ type: 'text', id: 'cam_nang_category_3_url', label: 'Link danh mục 3 - URL', default: '/ai/' });
      } else if (s.id === 'cam_nang_category_4_title' && !existingIds.has('cam_nang_category_4_url')) {
        newSettings.push({ type: 'text', id: 'cam_nang_category_4_url', label: 'Link danh mục 4 - URL', default: '/marketing/' });
      }
    }
    section.settings = newSettings;
  }
}
fs.writeFileSync(schemaPath, JSON.stringify(schemaData, null, 2), 'utf8');
console.log('settings_schema.json updated');

// 3. settings_data.json
const dataPath = path.join(shopDir, 'config/settings_data.json');
const dataJson = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
dataJson.current = dataJson.current || {};
if (!dataJson.current.cam_nang_category_1_url) dataJson.current.cam_nang_category_1_url = '/seo/';
if (!dataJson.current.cam_nang_category_2_url) dataJson.current.cam_nang_category_2_url = '/ai-seo/';
if (!dataJson.current.cam_nang_category_3_url) dataJson.current.cam_nang_category_3_url = '/ai/';
if (!dataJson.current.cam_nang_category_4_url) dataJson.current.cam_nang_category_4_url = '/marketing/';
fs.writeFileSync(dataPath, JSON.stringify(dataJson), 'utf8');
console.log('settings_data.json updated');