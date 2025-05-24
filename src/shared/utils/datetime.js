// Expects format: DDMMYYYY_HHMM
exports.parseCustomDatetime = (str) => {
  if (!str || typeof str !== 'string') return null
  const match = str.match(/^(\d{2})(\d{2})(\d{4})_(\d{2})(\d{2})$/)
  if (!match) throw new Error('Invalid datetime format. Use DDMMYYYY_HHMM')

  const [, dd, mm, yyyy, hh, min] = match
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:00`
}