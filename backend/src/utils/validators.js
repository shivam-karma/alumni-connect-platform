export function isEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}
export function isStrongPassword(pw) {
  return typeof pw === 'string' && pw.length >= 6;
}
