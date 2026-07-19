import assert from "node:assert/strict";
import { test } from "node:test";

import { createProoflineServer } from "../server.mjs";
import {
  PUBLIC_CONTACT_LIMITS,
  PUBLIC_CONTACTS_VERSION,
  discoverPublicProfessionalContacts
} from "../src/public-contacts-v1.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function withServer(fetchImpl, callback) {
  const server = createProoflineServer({
    tavilyKey: "test-key-never-sent",
    now: () => Date.parse("2026-07-19T12:00:00.000Z"),
    fetchImpl
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback(baseUrl);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("projects only sourced public professional channels with complete provenance", () => {
  const result = discoverPublicProfessionalContacts({
    companyName: "Acme Neuro",
    founderNames: ["Ada Founder"],
    submittedLinks: [
      "https://acmeneuro.example/contact",
      "https://ch.linkedin.com/in/ada-founder"
    ],
    evidence: [{
      url: "https://acmeneuro.example/contact",
      title: "Acme Neuro contact",
      excerpt: "Public business email: hello@acmeneuro.example. Office phone: +41 22 555 01 99.",
      queryKind: "DIRECT_LINK_EXTRACT",
      sourceType: "FIRST_PARTY",
      captureMethod: "TAVILY_EXTRACT"
    }]
  });

  assert.equal(result.contactDiscovery.version, PUBLIC_CONTACTS_VERSION);
  assert.equal(result.contactDiscovery.additionalProviderCalls, 0);
  assert.equal(result.contactDiscovery.policy.inferredEmailsAllowed, false);
  assert.equal(result.contactDiscovery.policy.searchSnippetContactValuesAllowed, false);
  assert.equal(result.contactDiscovery.policy.loginGatedContentAccessed, false);
  assert.deepEqual(
    result.publicContacts.map((item) => item.channel),
    ["BUSINESS_EMAIL", "BUSINESS_PHONE", "CONTACT_PAGE", "LINKEDIN"]
  );
  assert.equal(result.publicContacts.find((item) => item.channel === "BUSINESS_EMAIL").value, "hello@acmeneuro.example");
  assert.equal(result.publicContacts.find((item) => item.channel === "BUSINESS_PHONE").value, "+41 22 555 01 99");
  assert.equal(result.publicContacts.find((item) => item.channel === "LINKEDIN").subjectType, "FOUNDER");
  assert.equal(result.publicContacts.find((item) => item.channel === "LINKEDIN").subjectName, "Ada Founder");
  for (const contact of result.publicContacts) {
    assert.ok(contact.id.startsWith("CONTACT-"));
    assert.ok(contact.sourceUrl.startsWith("https://"));
    assert.ok(contact.subjectType);
    assert.ok(contact.subjectName);
    assert.ok(contact.channel);
    assert.ok(contact.label);
    assert.ok(contact.value);
    assert.ok(contact.verificationState);
    assert.equal(contact.publicProfessional, true);
    assert.equal(Object.isFrozen(contact), true);
  }
});

test("search snippets can expose a sourced route but can never create email or phone values", () => {
  const result = discoverPublicProfessionalContacts({
    companyName: "Acme Neuro",
    founderNames: ["Ada Founder"],
    evidence: [{
      url: "https://acmeneuro.example/contact",
      title: "Contact Acme Neuro",
      excerpt: "Email secret@acmeneuro.example or phone +41 22 555 01 99. Ada Founder is CEO.",
      queryKind: "ENTITY_AND_TRACTION",
      sourceType: "PUBLIC_WEB",
      captureMethod: "TAVILY_SEARCH"
    }]
  });

  assert.deepEqual(result.publicContacts.map((item) => item.channel), ["CONTACT_PAGE"]);
  assert.equal(result.publicContacts[0].verificationState, "UNREVIEWED_PUBLIC_SOURCE");
  assert.equal(JSON.stringify(result).includes("secret@acmeneuro.example"), false);
  assert.equal(JSON.stringify(result).includes("+41 22 555 01 99"), false);
});

test("does not elevate unrelated submitted pages, personal mailboxes, or non-entity evidence", () => {
  const result = discoverPublicProfessionalContacts({
    companyName: "Acme Neuro",
    founderNames: ["Ada Founder"],
    submittedLinks: ["https://news.example/acme-funding"],
    evidence: [
      {
        url: "https://news.example/acme-funding",
        title: "Funding story",
        excerpt: "Ada Founder can be reached at ada@gmail.com. Phone: +1 212 555 0100.",
        queryKind: "DIRECT_LINK_EXTRACT",
        sourceType: "FIRST_PARTY",
        captureMethod: "TAVILY_EXTRACT"
      },
      {
        url: "https://acmeneuro.example/research",
        title: "Acme Neuro study",
        excerpt: "Email info@acmeneuro.example.",
        queryKind: "ACADEMIC_VALIDATION",
        sourceType: "PUBLIC_WEB",
        captureMethod: "TAVILY_SEARCH"
      }
    ]
  });

  assert.deepEqual(result.publicContacts, []);
  assert.equal(result.contactDiscovery.status, "NO_PUBLIC_PROFESSIONAL_CHANNELS_FOUND");
});

test("matches an entity against the domain identity rather than a public suffix", () => {
  const result = discoverPublicProfessionalContacts({
    companyName: "VentureVision Robotics",
    founderNames: ["Example Founder"],
    submittedLinks: ["https://venturevision.example/about"]
  });

  assert.equal(result.publicContacts.length, 1);
  assert.equal(result.publicContacts[0].subjectType, "STARTUP");
  assert.equal(result.publicContacts[0].subjectName, "VentureVision Robotics");
});

test("deduplicates channels and enforces global and per-subject bounds", () => {
  const links = [
    "https://acmeneuro.example/contact",
    "https://acmeneuro.example/contact",
    "https://acmeneuro.example/connect",
    "https://acmeneuro.example/reach-us",
    "https://acmeneuro.example/get-in-touch",
    "https://acmeneuro.example/talk-to-us"
  ];
  const result = discoverPublicProfessionalContacts({
    companyName: "Acme Neuro",
    submittedLinks: links,
    evidence: [{
      url: "https://acmeneuro.example/contact",
      title: "Acme Neuro contact",
      excerpt: "Email: info@acmeneuro.example. Sales: sales@acmeneuro.example. Office phone: +41 22 555 01 99.",
      queryKind: "DIRECT_LINK_EXTRACT",
      sourceType: "FIRST_PARTY",
      captureMethod: "TAVILY_EXTRACT"
    }]
  });

  assert.ok(result.publicContacts.length <= PUBLIC_CONTACT_LIMITS.maxContacts);
  assert.ok(result.publicContacts.length <= PUBLIC_CONTACT_LIMITS.maxContactsPerSubject);
  assert.equal(new Set(result.publicContacts.map((item) => `${item.channel}|${item.value}`)).size, result.publicContacts.length);
});

test("investigation API retains contact evidence without adding provider calls", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: JSON.parse(options.body) });
    if (path === "/extract") {
      return jsonResponse({
        results: [{
          url: "https://acmeneuro.example/contact",
          raw_content: "Acme Neuro public business email: hello@acmeneuro.example. Office phone: +41 22 555 01 99."
        }],
        failed_results: [],
        request_id: "extract-contact",
        usage: { credits: 1 }
      });
    }
    return jsonResponse({
      query: "mocked",
      answer: "",
      results: [{
        title: "Ada Founder LinkedIn",
        url: "https://www.linkedin.com/in/ada-founder",
        content: "Ada Founder leads Acme Neuro.",
        score: 0.9
      }],
      request_id: "search-contact",
      usage: { credits: 1 }
    });
  };

  await withServer(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/investigate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: "Acme Neuro",
        founderNames: ["Ada Founder"],
        links: ["https://acmeneuro.example/contact"]
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(calls.map((item) => item.path), ["/extract", "/search"]);
    assert.match(calls[1].body.query, /public professional/i);
    assert.equal(body.contactDiscovery.additionalProviderCalls, 0);
    assert.ok(body.publicContacts.some((item) => item.channel === "BUSINESS_EMAIL" && item.value === "hello@acmeneuro.example"));
    assert.ok(body.publicContacts.some((item) => item.channel === "LINKEDIN" && item.subjectName === "Ada Founder"));
  });
});
