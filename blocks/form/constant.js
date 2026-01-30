export const fileAttachmentText = 'Attach';
export const dragDropText = 'Drag and Drop To Upload';

export const DEFAULT_THANK_YOU_MESSAGE = 'Thank You. Your form was submitted successfully.';

// Logging Configuration
// To set log level, modify this constant:
export const LOG_LEVEL = 'error'; // Available options: 'off', 'debug', 'info', 'warn', 'error'

export const defaultErrorMessages = {
  accept: 'The specified file type not supported.',
  maxFileSize: 'File too large. Reduce size and try again.',
  maxItems: 'Specify a number of items equal to or less than $0.',
  minItems: 'Specify a number of items equal to or greater than $0.',
  pattern: 'Specify the value in allowed format : $0.',
  minLength: 'Please lengthen this text to $0 characters or more.',
  maxLength: 'Please shorten this text to $0 characters or less.',
  maximum: 'Value must be less than or equal to $0.',
  minimum: 'Value must be greater than or equal to $0.',
  required: 'Please fill in this field.',
};

// eslint-disable-next-line no-useless-escape
export const emailPattern = '[a-zA-Z0-9.!#$%&\'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*';

let submitBaseUrl = '';
//export const submitBaseUrl = ‘https://publish-p157943-e1740770.adobeaemcloud.com’;

export const SUBMISSION_SERVICE = 'https://forms.adobe.com/adobe/forms/af/submit/';

export function setSubmitBaseUrl(url) {
  submitBaseUrl = url;
}

export function getSubmitBaseUrl() {
  return submitBaseUrl;
}
