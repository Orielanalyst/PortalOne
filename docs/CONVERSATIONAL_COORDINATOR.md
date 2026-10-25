# Conversational coordinator — 25 October 2026

The original browser sent every message directly to `investigate`. The human's
“Hello” therefore launched real model/tool activity without first establishing a
mission. That was a missing conversation layer, not evidence of a fake provider.
The earlier run is retained in history rather than rewritten.

The browser now uses a separate, model-backed conversation step. Greetings and
questions receive replies; missing context produces a clarification. An explicit
investigation request, or agreement to the coordinator's proposed investigation,
can hand a specific area/objective to the existing bounded worker graph. Users
continue talking to one coordinator, without selecting agents.

## What is persisted and checked

- SQLite keeps the user message, reply, decision, linked run and actual model
  receipt. Completed dialogue survives reload/restart; partial replies are marked
  interrupted rather than replayed. Nothing rewrites the earlier runs.
- The model receives the last six completed exchanges plus the latest structured
  investigation summary, blockers, report modes, community names and planning
  advice/status. It does not receive raw Kobo reports, reporter references or GPS.
  Follow-up questions can use those findings without starting another source read.
- The conversation step has no source or specialist tools. Its validated contract
  can return a reply or a specific investigation handoff. Only the latter starts
  the existing graph and, if selected, its watch. Concurrent investigation starts
  are rejected. One conversational reply is processed at a time.
- After a chat-launched investigation, a separate Nemotron call turns the structured
  findings into a conversational explanation and next question. This summary does
  not change the deterministic result, evidence revision or operational hold.
  Reply and summary model receipts can both be expanded in the conversation.
- Each conversation/summary call has a 256-token output budget and a 45-second
  provider timeout. Existing investigation calls retain their 128-token default;
  the five-minute graph budget is followed by the bounded conversational summary.
  Provider/contract errors show an explicit failure, with no canned successful
  model answer or silent offline fallback.

This reuses the installed Nightshift adapter, Zod and SQLite. No package, service
or credentials were added. Offline conversation explicitly states that no model
is running; the labelled replay action remains available separately.

## Try it

Open the local app and begin with “Hello”. Describe the mission naturally, answer
the coordinator's questions, then ask it to investigate when that is useful.
Inspect the live worker activity and ask about the results afterward. Questions
about prior results use the recorded findings; they are not fresh field checks.

The [live browser receipt](evidence/coordinator-conversation-2026-10-25.json)
records a greeting, a missing-area clarification, a capabilities question, an
explicit investigation, a model-backed wrap-up and a grounded follow-up. It binds
the demonstration to the executed source commit and hashes. Source/worker counts
remain unchanged through the three initial conversation-only messages.

## Current boundary

The available project and geography cover the demonstration corridor. Reports are
labelled demonstrations; resource ledgers remain synthetic and expired. Executable
routes, dispatch approval, public-news search and real resource feeds are not
connected to this chat. Six recent exchanges are bounded working context, not an
unlimited or structured mission-memory system. Formal cargo/deadline requirement
extraction and version-bound operator decisions remain separate build gates.
