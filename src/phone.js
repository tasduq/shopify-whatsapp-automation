// Normalizes a phone number to the E.164-like format WhatsApp's Cloud API expects:
//   <country_code><national_number>   (digits only, no leading '+')
//
// Handles the common cases seen in Shopify checkout data:
//   - '+92 300 1234567'  -> '923001234567'
//   - '0300 1234567'     -> '923001234567'  (Pakistani mobile, leading 0 stripped)
//   - '00923001234567'   -> '923001234567'
//   - '92-300-1234567'   -> '923001234567'
//
// DEFAULT_COUNTRY_CODE (env) is used when the number has no country code prefix.
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '92';

function normalizePhone(input) {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') input = String(input);

  let digits = input.replace(/\D/g, '');

  // Drop leading '00' international prefix (e.g. 0092 -> 92)
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // No country code: assume local number. Strip a leading '0' and prepend default code.
  if (!digits.startsWith(DEFAULT_COUNTRY_CODE)) {
    if (digits.startsWith('0')) digits = digits.slice(1);
    digits = DEFAULT_COUNTRY_CODE + digits;
  }

  return digits;
}

module.exports = { normalizePhone, DEFAULT_COUNTRY_CODE };