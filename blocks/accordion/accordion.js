/*
 * Accordion Block
 * Recreate an accordion
 * https://www.hlx.live/developer/block-collection/accordion
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  [...block.children].forEach((row) => {
    // decorate accordion item label
    const label = row.children[0];
    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(...label.childNodes);
    // decorate accordion item body
    const body = row.children[1];
    body.className = 'accordion-item-body';
    // decorate accordion item
    const details = document.createElement('details');
    moveInstrumentation(row, details);
    details.className = 'accordion-item';
    details.append(summary, body);
    row.replaceWith(details);
  });

  // Add ID generation for accordion blocks
  const blocks = document.querySelectorAll(`.accordion`);
  blocks.forEach((block, index) => {
    block.id = `accordion-${index}`;
    
    // Get all accordion items (details elements)
    const items = block.querySelectorAll('details');
    items.forEach((item, itemIndex) => {
      item.setAttribute('data-text-block-index', itemIndex);
      
      // Add IDs to text elements within each accordion item
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].forEach((tag) => {
        const elements = item.querySelectorAll(tag);
        elements.forEach((el) => {
          const textBlockElements = item.querySelectorAll(tag);
          const tagIndex = Array.from(textBlockElements).indexOf(el);
          el.id = `accordion_${index}_text_${itemIndex}_${tag}_${tagIndex}`;
        });
      });
    });

    // Add IDs to images if any
    const images = block.querySelectorAll('img');
    images.forEach((img, imgIndex) => {
      img.id = `accordion_${index}_image_${imgIndex}`;
    });
  });
}