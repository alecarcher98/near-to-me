// Public details about who runs the site; set these in the hosting environment.
export const site = {
  name: "Near to me",
  operator: process.env.NEXT_PUBLIC_OPERATOR_NAME || "Near to me",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
};
