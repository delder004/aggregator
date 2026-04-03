const BUTTONDOWN_API_URL = 'https://api.buttondown.com/v1/emails';

export async function createNewsletterDraft(
  apiKey: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    const response = await fetch(BUTTONDOWN_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        body,
        status: 'draft',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Buttondown API error ${response.status}: ${text}`);
      return false;
    }

    console.log('Newsletter draft created in Buttondown');
    return true;
  } catch (err) {
    console.error('Failed to create newsletter draft:', err);
    return false;
  }
}
