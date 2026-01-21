/**
 * Demo Mode - Mock data for demo experience
 * Provides realistic fake emails, contacts, and summaries for users to try the app
 */

export interface DemoContact {
  _id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  relationship: "vip" | "regular" | "unknown";
  facts?: Array<{
    id: string;
    text: string;
    source: "manual" | "ai";
    createdAt: number;
  }>;
}

export interface DemoEmail {
  _id: string;
  externalId: string;
  subject: string;
  bodyPreview: string;
  bodyFull: string;
  from: string; // contact _id
  fromContact?: DemoContact;
  receivedAt: number;
  isRead: boolean;
  isTriaged: boolean;
  triageAction?: "done" | "reply_needed" | "delegated";
  direction: "incoming" | "outgoing";
}

export interface DemoSummary {
  emailId: string;
  summary: string;
  urgencyScore: number;
  urgencyReason: string;
  actionRequired: "reply" | "action" | "fyi" | "none";
  actionDescription?: string;
  quickReplies?: Array<{
    label: string;
    body: string;
  }>;
  calendarEvent?: {
    title: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
  };
}

// Generate mock contacts
export const generateDemoContacts = (): DemoContact[] => [
  {
    _id: "demo_contact_1",
    email: "sarah.chen@techcorp.com",
    name: "Sarah Chen",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=SarahChen",
    relationship: "vip",
    facts: [
      {
        id: "fact_1",
        text: "Works at TechCorp as Product Manager",
        source: "ai",
        createdAt: Date.now() - 86400000,
      },
      {
        id: "fact_2",
        text: "Prefers morning meetings",
        source: "ai",
        createdAt: Date.now() - 172800000,
      },
    ],
  },
  {
    _id: "demo_contact_2",
    email: "james.williams@startup.io",
    name: "James Williams",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=JamesWilliams",
    relationship: "regular",
    facts: [
      {
        id: "fact_3",
        text: "Founder of Startup.io",
        source: "ai",
        createdAt: Date.now() - 86400000,
      },
    ],
  },
  {
    _id: "demo_contact_3",
    email: "emily.rodriguez@design.studio",
    name: "Emily Rodriguez",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=EmilyRodriguez",
    relationship: "regular",
  },
  {
    _id: "demo_contact_4",
    email: "michael.kim@consulting.com",
    name: "Michael Kim",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=MichaelKim",
    relationship: "regular",
  },
  {
    _id: "demo_contact_5",
    email: "newsletter@techweekly.com",
    name: "Tech Weekly Newsletter",
    relationship: "unknown",
  },
  {
    _id: "demo_contact_6",
    email: "alex.patel@venture.capital",
    name: "Alex Patel",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=AlexPatel",
    relationship: "vip",
    facts: [
      {
        id: "fact_4",
        text: "Partner at Venture Capital firm",
        source: "ai",
        createdAt: Date.now() - 259200000,
      },
    ],
  },
  {
    _id: "demo_contact_7",
    email: "lisa.thompson@hr-corp.com",
    name: "Lisa Thompson",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=LisaThompson",
    relationship: "regular",
  },
  {
    _id: "demo_contact_8",
    email: "david.nguyen@agency.co",
    name: "David Nguyen",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=DavidNguyen",
    relationship: "regular",
  },
];

// Generate mock emails
export const generateDemoEmails = (contacts: DemoContact[]): DemoEmail[] => {
  const now = Date.now();
  const hour = 3600000;
  const day = 86400000;

  const emails: DemoEmail[] = [
    {
      _id: "demo_email_1",
      externalId: "demo_1",
      subject: "Quick sync on Q1 roadmap",
      bodyPreview: "Hey! I wanted to touch base about our Q1 product roadmap. Can we schedule a call this week?",
      bodyFull: "Hey! I wanted to touch base about our Q1 product roadmap. We need to finalize the feature prioritization before our stakeholder meeting next Friday. Can we schedule a call this week? I'm free Tuesday afternoon or Thursday morning. Let me know what works for you!\n\nBest,\nSarah",
      from: contacts[0]._id,
      fromContact: contacts[0],
      receivedAt: now - 2 * hour,
      isRead: false,
      isTriaged: false,
      direction: "incoming",
    },
    {
      _id: "demo_email_2",
      externalId: "demo_2",
      subject: "Follow-up: Partnership opportunity",
      bodyPreview: "Following up on our conversation last week. I think there's a great opportunity for collaboration...",
      bodyFull: "Hi there,\n\nFollowing up on our conversation last week about potential partnership opportunities. I think there's a great opportunity for collaboration between our companies.\n\nI've put together a brief proposal outlining how we could work together. Would you be interested in hopping on a call next week to discuss? I'm particularly excited about the synergies in our product offerings.\n\nLooking forward to hearing from you!\n\nJames",
      from: contacts[1]._id,
      fromContact: contacts[1],
      receivedAt: now - 5 * hour,
      isRead: false,
      isTriaged: false,
      direction: "incoming",
    },
    {
      _id: "demo_email_3",
      externalId: "demo_3",
      subject: "Design mockups for review",
      bodyPreview: "I've finished the mockups for the new dashboard. Take a look and let me know your thoughts!",
      bodyFull: "Hey!\n\nI've finished the mockups for the new dashboard redesign. I incorporated all the feedback from our last review session. The files are in the shared Figma workspace.\n\nKey changes:\n- Simplified navigation\n- New color palette\n- Improved mobile responsiveness\n\nTake a look when you get a chance and let me know your thoughts!\n\nEmily",
      from: contacts[2]._id,
      fromContact: contacts[2],
      receivedAt: now - 1 * day,
      isRead: true,
      isTriaged: false,
      direction: "incoming",
    },
    {
      _id: "demo_email_4",
      externalId: "demo_4",
      subject: "Consulting proposal - Review needed",
      bodyPreview: "Attached is the consulting proposal for your review. Please review by EOD Friday...",
      bodyFull: "Hi,\n\nAttached is the consulting proposal we discussed. This outlines the scope of work, timeline, and pricing for the project.\n\nKey deliverables:\n- Market analysis report\n- Strategic recommendations\n- Implementation roadmap\n\nPlease review by EOD Friday so we can start next week. Let me know if you have any questions!\n\nBest regards,\nMichael Kim",
      from: contacts[3]._id,
      fromContact: contacts[3],
      receivedAt: now - 1 * day - 6 * hour,
      isRead: true,
      isTriaged: false,
      direction: "incoming",
    },
    {
      _id: "demo_email_5",
      externalId: "demo_5",
      subject: "Tech Weekly: AI and the Future of Work",
      bodyPreview: "This week: How AI is transforming workplace productivity, the rise of remote-first companies...",
      bodyFull: "Tech Weekly Newsletter - Week of January 20, 2026\n\nTop Stories:\n- How AI is transforming workplace productivity\n- The rise of remote-first companies\n- New funding rounds in the startup ecosystem\n- Developer tools you need to try\n\nRead more at techweekly.com\n\nUnsubscribe | Manage preferences",
      from: contacts[4]._id,
      fromContact: contacts[4],
      receivedAt: now - 2 * day,
      isRead: true,
      isTriaged: false,
      direction: "incoming",
    },
    {
      _id: "demo_email_6",
      externalId: "demo_6",
      subject: "Coffee next week?",
      bodyPreview: "I'll be in town next week. Would love to catch up over coffee if you're available!",
      bodyFull: "Hey,\n\nI'll be in town next week for a conference. Would love to catch up over coffee if you're available!\n\nI'm free Monday afternoon or Tuesday morning. There's a great new coffee shop downtown I've been wanting to try. Let me know if either time works for you.\n\nCheers,\nAlex",
      from: contacts[5]._id,
      fromContact: contacts[5],
      receivedAt: now - 3 * hour,
      isRead: false,
      isTriaged: false,
      direction: "incoming",
    },
    {
      _id: "demo_email_7",
      externalId: "demo_7",
      subject: "Team building event - RSVP needed",
      bodyPreview: "We're planning a team building event for next month. Please RSVP by this Friday...",
      bodyFull: "Hi everyone,\n\nWe're planning a team building event for next month! We're thinking about doing an escape room followed by dinner.\n\nDate: February 15th, 6pm\nLocation: Downtown Escape Room & Grill\n\nPlease RSVP by this Friday so we can finalize the headcount. We need at least 10 people to book the space.\n\nLooking forward to seeing everyone there!\n\nLisa Thompson\nHR Department",
      from: contacts[6]._id,
      fromContact: contacts[6],
      receivedAt: now - 2 * day - 3 * hour,
      isRead: true,
      isTriaged: false,
      direction: "incoming",
    },
    {
      _id: "demo_email_8",
      externalId: "demo_8",
      subject: "Website project - Timeline update",
      bodyPreview: "Quick update on the website redesign timeline. We're running a bit behind schedule...",
      bodyFull: "Hi,\n\nQuick update on the website redesign timeline. We're running a bit behind schedule due to some unexpected technical challenges with the CMS migration.\n\nNew timeline:\n- Design finalization: This week\n- Development: Next 3 weeks\n- Testing: 1 week\n- Launch: Mid-February\n\nThis pushes us back about 2 weeks from the original plan. Let me know if this causes any issues with your marketing schedule.\n\nThanks for your patience!\n\nDavid",
      from: contacts[7]._id,
      fromContact: contacts[7],
      receivedAt: now - 4 * day,
      isRead: true,
      isTriaged: false,
      direction: "incoming",
    },
  ];

  return emails;
};

// Generate mock summaries for emails
export const generateDemoSummaries = (emails: DemoEmail[]): DemoSummary[] => [
  {
    emailId: emails[0]._id,
    summary: "Sarah wants to schedule a call this week to finalize Q1 product roadmap before stakeholder meeting next Friday. She's available Tuesday afternoon or Thursday morning.",
    urgencyScore: 85,
    urgencyReason: "Time-sensitive request with specific deadline (stakeholder meeting next Friday). Needs response to schedule meeting.",
    actionRequired: "reply",
    actionDescription: "Schedule a call for Tuesday or Thursday",
    quickReplies: [
      {
        label: "Tuesday works!",
        body: "Tuesday afternoon works great for me! Does 2pm work for you? Looking forward to discussing the roadmap.",
      },
      {
        label: "Thursday better",
        body: "Thursday morning would be better for me. How about 10am? We can finalize everything before the stakeholder meeting.",
      },
      {
        label: "Need to reschedule",
        body: "Thanks for reaching out! This week is a bit packed for me. Could we aim for early next week instead? That would still give us time before the stakeholder meeting.",
      },
    ],
  },
  {
    emailId: emails[1]._id,
    summary: "James is following up on last week's conversation about partnership opportunities. He has a proposal ready and wants to schedule a call next week.",
    urgencyScore: 65,
    urgencyReason: "Follow-up email about business opportunity. Not urgent but requires response to move forward.",
    actionRequired: "reply",
    actionDescription: "Respond about partnership call",
    quickReplies: [
      {
        label: "Interested!",
        body: "Thanks for following up! I'd definitely be interested in discussing this further. Next week works for me - how about Wednesday afternoon?",
      },
      {
        label: "Need more info",
        body: "Thanks for reaching out. Could you send over the proposal first? I'd like to review it before we schedule a call.",
      },
    ],
  },
  {
    emailId: emails[2]._id,
    summary: "Emily has completed the dashboard redesign mockups with all feedback incorporated. Changes include simplified navigation, new colors, and better mobile support. Files are in Figma.",
    urgencyScore: 45,
    urgencyReason: "Mockups ready for review, but no urgent deadline mentioned.",
    actionRequired: "action",
    actionDescription: "Review Figma mockups and provide feedback",
    quickReplies: [
      {
        label: "Will review today",
        body: "Thanks Emily! The changes sound great. I'll review the Figma files today and get you feedback by tomorrow.",
      },
      {
        label: "Looks good!",
        body: "Just took a quick look - these look fantastic! Love the simplified navigation. Let's schedule a quick call to discuss next steps.",
      },
    ],
  },
  {
    emailId: emails[3]._id,
    summary: "Michael sent consulting proposal covering market analysis, strategic recommendations, and implementation roadmap. Needs review by Friday EOD to start next week.",
    urgencyScore: 90,
    urgencyReason: "Deadline is Friday EOD. Requires document review and approval to proceed.",
    actionRequired: "action",
    actionDescription: "Review proposal by Friday EOD",
    quickReplies: [
      {
        label: "Will review soon",
        body: "Thanks Michael! I'll review the proposal and get back to you by Thursday. Looking forward to working together.",
      },
      {
        label: "Have questions",
        body: "Thanks for sending this over. I have a few questions about the timeline and pricing. Can we hop on a quick call tomorrow to discuss?",
      },
    ],
  },
  {
    emailId: emails[4]._id,
    summary: "Tech Weekly newsletter covering AI in workplace productivity, remote-first companies, startup funding, and developer tools.",
    urgencyScore: 10,
    urgencyReason: "Newsletter, informational only, no action required.",
    actionRequired: "fyi",
  },
  {
    emailId: emails[5]._id,
    summary: "Alex will be in town next week for a conference and wants to meet for coffee. Available Monday afternoon or Tuesday morning.",
    urgencyScore: 55,
    urgencyReason: "Casual meeting request for next week. Would be polite to respond but not urgent.",
    actionRequired: "reply",
    actionDescription: "Respond about coffee meeting",
    quickReplies: [
      {
        label: "Monday works!",
        body: "Hey Alex! Monday afternoon works perfectly. How about 3pm at that new coffee shop you mentioned? Send me the address!",
      },
      {
        label: "Can't make it",
        body: "Thanks for thinking of me! Unfortunately I'm swamped next week. Could we catch up over a video call instead?",
      },
    ],
  },
  {
    emailId: emails[6]._id,
    summary: "HR is organizing team building event on Feb 15th (escape room + dinner). RSVP needed by Friday to confirm headcount.",
    urgencyScore: 60,
    urgencyReason: "RSVP deadline this Friday. Event requires minimum attendee count.",
    actionRequired: "reply",
    actionDescription: "RSVP for team building event",
    quickReplies: [
      {
        label: "I'll be there!",
        body: "Count me in! Sounds like fun. See you on Feb 15th!",
      },
      {
        label: "Can't make it",
        body: "Thanks for organizing this! Unfortunately I have a conflict on Feb 15th and won't be able to make it.",
      },
    ],
    calendarEvent: {
      title: "Team Building Event",
      startTime: "2026-02-15T18:00:00",
      endTime: "2026-02-15T21:00:00",
      location: "Downtown Escape Room & Grill",
      description: "Team building event with escape room and dinner",
    },
  },
  {
    emailId: emails[7]._id,
    summary: "Website redesign delayed by 2 weeks due to CMS migration issues. New launch date is mid-February. David checking if this affects marketing schedule.",
    urgencyScore: 70,
    urgencyReason: "Timeline change notification that may impact other plans. Should acknowledge and confirm if this causes issues.",
    actionRequired: "reply",
    actionDescription: "Confirm if timeline change is okay",
    quickReplies: [
      {
        label: "That's fine",
        body: "Thanks for the update David. The 2-week delay works fine on our end. We can adjust the marketing schedule accordingly.",
      },
      {
        label: "Let's discuss",
        body: "Thanks for letting me know. This might impact our campaign timeline. Can we hop on a call to discuss alternatives?",
      },
    ],
  },
];
