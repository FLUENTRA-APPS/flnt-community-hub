# Flnt: Community Trust Platform

Build a full-stack web app named “flnt” using Lovable Cloud for authentication, database, access control, and email-related server logic. Enable the backend first. The product combines update voting, business trust reviews, admin moderation, and support tickets.

Core design: polished, responsive, clear community platform. Use the flnt name. Create a public landing page with entry points to Updates, Trusted Businesses, Support, and Sign in. Do not expose private emails publicly.

Authentication and email (1.4): implement signup/sign-in with email verification. During signup, send a professional branded email containing a random 6-digit verification code. Require verification to use authenticated features. For each future login, send a new 6-digit email confirmation code as requested (email-code login confirmation / MFA). Ask the user for SMTP host, port, username, password, sender domain/email via the platform’s secure secret/configuration request when implementation reaches configuration. Do not put SMTP credentials in source code, database, UI, or chat. Explain that an email-capable server flow needs the supplied SMTP configuration.

Updates/polls (1.1): authenticated user can create an update poll. Required fields: poll topic/title, original author (display name), author email (private, only visible to authorized admins/owner), topic description, and an owner explanation of why the update/change is proposed. Each poll has a random 10-digit public URL code at /[random-10-digit-code] (ensure uniqueness) and clear Yes / No voting. Enforce one vote per signed-in user per poll, while allowing a user to change their vote. Show counts, total votes, percentage, author, description, explanation, and a threaded replies/comments section for authenticated users. When Yes votes first exceed 1,000, email the poll owner a professional notification with the poll link and vote status. Persist a one-time notification flag so it does not send repeatedly; securely use SMTP configuration.

Business trust directory (1.2): page /trust/become lets authenticated users create a business/seller listing. Fields: seller name, business type, and unique business slug/name, max 15 characters. Public listing at /trust/[unique-name]. Visitors can view listing/reviews; authenticated users can submit a rating only once every 24 hours per business. Rating interaction supports 0.5-star increments through accessible controls; desktop right-click and double-click on a star should select a half-star if practical, with normal click selecting a full star. Add a review text field and prevent duplicate voting inside 24 hours server-side. Show average rating, rating count, reviews, seller info. Once a business has 5,000+ eligible ratings and average rating strictly greater than 2.5, show a blue-tick emoji/badge; on hover/title explain “Verified seller / business man”. Ensure this badge is computed reliably and cannot be self-granted by users.

Admin (1.3): seed or ensure an admin account using the provided email ahmedalihusnain0@gmail.com and password 33b3e110, with an admin role that is enforced on the server/database level. Do not show or repeat the password in UI, logs, or documentation. If the platform requires secure credential setup or reset rather than hard-coding, request it securely and explain. Create /admin dashboard restricted to admins only. Admin can see all users, manage user verification/roles, manually grant/revoke the verified seller/business badge, and add arbitrary administrative vote adjustments to a business. Preserve an audit log for every admin action, including actor, target, timestamp, prior/new values, and reason. Clearly distinguish organic ratings and admin-adjusted vote totals in data/UI where relevant. Add /admin/tickets.

Support (1.5): /support authenticated users can create only one currently-open support ticket at a time, with a reason/subject then a conversation. User and admins can exchange messages. Admin ticket view lists tickets with status, user, time, and can open and reply. Allow admins to close/resolve tickets; once resolved, the user may create a new ticket. Secure data access so a user can see only their own tickets and admins can see all.

Use robust validation, rate-limit/sensible abuse protection where appropriate, RLS/access control for all private data, and responsive accessible UI. Build the implementation and test key flows. Provide a brief summary of anything that needs the owner to configure, especially SMTP secrets.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flnt-community-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9044bbe8-9c66-47bd-b380-dcf280901411).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
