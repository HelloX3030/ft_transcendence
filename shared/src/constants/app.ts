/**
 * The product name, as shown to users. Deliberately a constant and not an env
 * var: the logo, the mail subjects and the legal documents all spell it out
 * literally, so a configurable value could only ever rename part of the app.
 *
 * index.html carries the same string as a literal — static HTML cannot import
 * this, and reintroducing build-time substitution to avoid one duplicate is
 * exactly what this change undoes.
 */
export const APP_NAME = "CineMates";
