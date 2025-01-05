const fallbackPagePath = new URL(
  '../../errorPage/noConnection.html',
  import.meta.url
).pathname

export async function NotSupportedRouter (req, res) {
  res.status(502).sendFile(fallbackPagePath)
}
