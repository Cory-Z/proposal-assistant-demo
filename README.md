# Proposal Assistant (portfolio demo)

A static web app that turns the messy front end of a consulting proposal into a structured, repeatable workflow, and hands the result to AI skills that find similar past work and draft the proposal.

I built the original for a human factors engineering consultancy. **This repository is a sanitized portfolio version.** The company ("Acme HF"), clients, people, proposals, links and prices are all fictional, nothing is sent anywhere, and there are no logins, analytics or live databases. Everything runs in your browser.

## The problem

Proposals for regulated-industry studies were slow and inconsistent. Scoping details lived in people's heads and in email threads, pricing was a spreadsheet with a lot of hidden judgement, and nobody could quickly answer "have we scoped something like this before?". Each proposal started nearly from scratch.

## What I built

**A two-step intake.** An SME intake form captures study scope and design (user groups, session lengths, deliverables). A commercial intake form imports that output, checks it, and adds pricing inputs, staffing and project management. Each form ends with a copy-and-paste block of structured data, so nothing has to be retyped between steps.

**A pricing calculator** that follows the firm's estimating method: study days from participants and session length, facility and recruitment costs, tiered pass-through fees, report effort, markup and rounding rules. The same engine is embedded in the intake forms and in the skill that drafts the proposal, so the number a person sees is the number that ends up in the document. (All rates and hours in this demo are invented.)

**A timeline builder** that lays out week-by-week schedules from the same inputs, with holiday awareness, a month view for long projects, direct editing (paint, move and resize bars), and export to a copyable table, a PowerPoint slide, or an image.

**A ballpark quote builder** for quick low/high ranges formatted for email.

**A searchable proposal database.** The site loads an index of past proposals, SOWs, amendments and client requests with tags (device type, therapeutic area, study type, structure, deal size). You can browse and filter it, search it by free text, and generate a prompt that asks the AI search skill to go deeper, including slide-level text. The demo ships with 60-odd invented entries.

**A team schedule** showing proposal due dates and review status in list and calendar views. In the original it synced live through a hosted database; in this demo a small in-browser stand-in keeps the same calls working.

**A de-identification helper** that scans pasted request text for likely client names and sensitive phrases before anything is sent to an AI tool. It runs entirely client-side.

## The AI skills behind it

The site is the front door; three Claude skills do the heavy lifting in the original (they are not part of this repository):

1. **Draft skill.** Takes the structured intake output, decodes the pricing data, runs the same calculator code, pulls the closest past proposals from the index as references, and builds a first-pass Word SOW or PowerPoint deck from the firm's templates. It finishes with a review list of everything a human should check (assumptions, terminology, pricing, anything it could not verify).
2. **Search skill.** Reads the proposal index and answers questions such as "list proposals for this device type" or "find the closest past proposals to this request", returning links.
3. **Index maintenance skill.** Runs weekly to find new or changed documents, tag them, and refresh the index, with a short report of what changed.

Design choices worth noting: tools are static files with no backend to run; the structured hand-off blocks make the workflow testable; every AI output ends with an explicit "needs human review" list; and sensitive source material stays in a restricted folder instead of in the public site.

## Tech

Plain HTML, CSS and JavaScript (no build step). `pptxgenjs` for PowerPoint export, canvas for image export. Hosting is any static host (GitHub Pages works).

## Run it

Open `index.html` through any static server, for example `python3 -m http.server` in this folder, then visit `http://localhost:8000`. Opening the file directly may block loading the sample index.

## What's fictional

Company, logo, clients, people and titles, proposal entries and links, schedule data, and every rate, fee and price. Any resemblance to real organizations is coincidental. This is a demonstration of the workflow, not a pricing reference.

Built by Corien Zavod.
