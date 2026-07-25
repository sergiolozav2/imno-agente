export const generateOGImage = async () =>
  Response.json(
    {
      error: 'Open Graph images are disabled',
    },
    {
      status: 404,
    },
  )
