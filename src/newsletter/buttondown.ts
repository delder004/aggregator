const BUTTONDOWN_API_URL = 'https://api.buttondown.com/v1/emails';
const BUTTONDOWN_SUBSCRIBERS_URL = 'https://api.buttondown.com/v1/subscribers';

export async function addSubscriberToButtondown(
  apiKey: string,
  email: string
): Promise<boolean> {
  try {
    const response = await fetch(BUTTONDOWN_SUBSCRIBERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (response.ok) {
      console.log(`Subscriber added to Buttondown: ${email}`);
      return true;
    }

    // 409 = subscriber already exists, which is fine
    if (response.status === 409) {
      console.log(`Subscriber already exists in Buttondown: ${email}`);
      return true;
    }

    const text = await response.text();
    console.error(`Buttondown subscriber API error ${response.status}: ${text}`);
    return false;
  } catch (err) {
    console.error('Failed to add subscriber to Buttondown:', err);
    return false;
  }
}

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
