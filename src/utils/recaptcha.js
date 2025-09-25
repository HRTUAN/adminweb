export async function verifyRecaptcha(token, remoteip) {
  try {
    const enabled = process.env.ENABLE_RECAPTCHA === "true";
    if (!enabled) return { success: true };
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      return { success: false, error: "Missing RECAPTCHA_SECRET_KEY" };
    }
    if (!token) {
      return { success: false, error: "Missing reCAPTCHA token" };
    }

    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);
    if (remoteip) params.append("remoteip", remoteip);

    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await resp.json();
    return data;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
