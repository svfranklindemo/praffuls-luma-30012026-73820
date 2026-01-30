/*
import { patternDecorate } from '../../scripts/blockTemplate.js';

export default async function decorate(block) {
  patternDecorate(block);
}
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    
    // Read card style from the third div (index 2)
    const styleDiv = row.children[2];
    const styleParagraph = styleDiv?.querySelector('p');
    const cardStyle = styleParagraph?.textContent?.trim() || 'default';
    if (cardStyle && cardStyle !== 'default') {
      li.className = cardStyle;
    }
    
    // Read CTA style from the fourth div (index 3)
    const ctaDiv = row.children[3];
    const ctaParagraph = ctaDiv?.querySelector('p');
    const ctaStyle = ctaParagraph?.textContent?.trim() || 'default';
    
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    
    // Process the li children to identify and style them correctly
    [...li.children].forEach((div, index) => {
      // First div (index 0) - Image
      if (index === 0) {
        div.className = 'cards-card-image';
      }
      // Second div (index 1) - Content with button
      else if (index === 1) {
        div.className = 'cards-card-body';
      }
      // Third div (index 2) - Card style configuration
      else if (index === 2) {
        div.className = 'cards-config';
        const p = div.querySelector('p');
        if (p) {
          p.style.display = 'none'; // Hide the configuration text
        }
      }
      // Fourth div (index 3) - CTA style configuration
      else if (index === 3) {
        div.className = 'cards-config';
        const p = div.querySelector('p');
        if (p) {
          p.style.display = 'none'; // Hide the configuration text
        }
      }
      // Any other divs
      else {
        div.className = 'cards-card-body';
      }
    });
    
    // Apply CTA styles to button containers
    const buttonContainers = li.querySelectorAll('p.button-container');
    buttonContainers.forEach(buttonContainer => {
      // Remove any existing CTA classes
      buttonContainer.classList.remove('default', 'cta-button', 'cta-button-secondary', 'cta-button-dark', 'cta-default');
      // Add the correct CTA class
      buttonContainer.classList.add(ctaStyle);
    });
    
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
 
  block.textContent = '';
  block.append(ul);

  // Add ID generation for all cards blocks
  const blocks = document.querySelectorAll(`.cards`);
  blocks.forEach((block, index) => {
    block.id = `cards-${index}`;
    
    // Add indexed IDs to images within the block
    const images = block.querySelectorAll('img');
    images.forEach((img, imgIndex) => {
      const imgId = `cards_${index}_image_${imgIndex}`;
      img.id = imgId;
    });

    // Add indexed IDs to text content divs only
    const cardBodies = block.querySelectorAll('.cards-card-body');
    cardBodies.forEach((cardBody, bodyIndex) => {
      cardBody.setAttribute('data-text-block-index', bodyIndex);
    });

    // Add indexed IDs to heading elements with container context
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].forEach((tag) => {
      const elements = block.querySelectorAll(tag);
      elements.forEach((el) => {
        const textBlock = el.closest('[data-text-block-index]');
        const textBlockIndex = textBlock ? textBlock.getAttribute('data-text-block-index') : 'unknown';
        
        // Count this tag within its text block
        const textBlockElements = textBlock ? textBlock.querySelectorAll(tag) : [el];
        const tagIndex = Array.from(textBlockElements).indexOf(el);
        
        el.id = `cards_${index}_text_${textBlockIndex}_${tag}_${tagIndex}`;
      });
    });
  });
}
