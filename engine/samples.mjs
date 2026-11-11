// Sample reviews used ONLY when a business has no real reviews yet.
// Every sample renders with a visible "Sample" tag, is never added to schema.org
// markup, and `build.mjs --final` refuses to build while any are on the page.
// Swap them for real reviews (Google, Facebook, Yelp) with the customer's permission.

export const SAMPLE_REVIEWS = {
  roofing: [
    { text: 'Two other companies wanted to replace the whole roof. They found the bad flashing around the chimney, fixed it in an afternoon and sent photos of every step.', service: 'Leak repair' },
    { text: 'Crew showed up at 7, had the old shingles off by lunch and the yard magnet-swept before they left on day two. Not a single nail in the driveway.', service: 'Roof replacement' },
    { text: 'After the hail storm they met the adjuster on the roof with us and documented everything. The claim went through without a fight.', service: 'Storm damage' },
  ],
  plumbing: [
    { text: 'Water heater died on a Sunday morning. They had a new one in by 3pm and walked me through the pricing before touching anything.', service: 'Water heater' },
    { text: 'Camera inspection showed roots in the sewer line. They showed me the video, gave me two options in writing, and the price did not change.', service: 'Sewer line' },
    { text: 'Small job, a dripping shower valve, and they treated it like it mattered. Booties on, cleaned up after, done in under an hour.', service: 'Repair' },
  ],
  hvac: [
    { text: 'AC quit during the first heat wave. Tech was here the same evening, found a failed capacitor and had us cooling again in 40 minutes.', service: 'AC repair' },
    { text: 'They talked us out of the biggest system and sized it properly for the house. Bills are lower and the upstairs finally stays cool.', service: 'Installation' },
    { text: 'The tune-up plan is worth it. They remind us twice a year and the furnace has not had a problem since.', service: 'Maintenance' },
  ],
  electrical: [
    { text: 'Upgraded our old 100 amp panel so we could add an EV charger. Permit, inspection and power back on the same day.', service: 'Panel upgrade' },
    { text: 'Half the kitchen outlets stopped working. They traced it to a failed GFCI two rooms away and did not try to upsell anything.', service: 'Troubleshooting' },
    { text: 'Clean work on the recessed lighting. Patched every hole and you cannot tell where they cut.', service: 'Lighting' },
  ],
  landscaping: [
    { text: 'They regraded the side yard that flooded every spring and put in a dry creek bed. First big storm, the basement stayed dry.', service: 'Drainage' },
    { text: 'Weekly crew is the same three people every time and they notice things, like the sprinkler head that was watering the fence.', service: 'Maintenance' },
    { text: 'The new patio came in on budget and they planted around it so it looks like it has always been there.', service: 'Hardscape' },
  ],
  painting: [
    { text: 'Prep took longer than the painting, which is exactly what you want. Two years later the trim still looks sharp.', service: 'Exterior' },
    { text: 'They moved the furniture, covered everything and finished three bedrooms in two days. The lines at the ceiling are perfect.', service: 'Interior' },
    { text: 'Color consult helped us avoid a mistake. The sample boards on the actual walls made the decision easy.', service: 'Color consult' },
  ],
  'pest-control': [
    { text: 'Mice in the garage every winter. They sealed the gaps instead of just putting out bait and we have not seen one since.', service: 'Rodent exclusion' },
    { text: 'Tech explained what he was spraying and where, and kept it away from the vegetable beds without us asking.', service: 'General pest' },
    { text: 'Quarterly service is easy. They text the day before and leave a note on what they found.', service: 'Quarterly plan' },
  ],
  cleaning: [
    { text: 'Same two cleaners every visit and they remember how we like things. The baseboards have never been this clean.', service: 'Recurring cleaning' },
    { text: 'Move-out clean got our full deposit back. The landlord asked who did it.', service: 'Move-out' },
    { text: 'They work around the dog and the home office without fuss. Booking and paying is all by text.', service: 'Weekly' },
  ],
  remodeling: [
    { text: 'Kitchen remodel finished one day early. We got a written schedule up front and a text update every evening.', service: 'Kitchen' },
    { text: 'They found rot behind the shower tile, showed us before fixing it, and the change order was exactly what they quoted.', service: 'Bathroom' },
    { text: 'Dust walls and daily cleanup meant we could live in the house the whole time.', service: 'Whole-home' },
  ],
  'garage-doors': [
    { text: 'Spring snapped at 6am with the car inside. They had it replaced before 9 and checked the cables and rollers while they were there.', service: 'Spring repair' },
    { text: 'New insulated door made the garage usable as a workshop in winter. Install took about four hours.', service: 'New door' },
    { text: 'Opener was louder than a truck. They swapped it for a belt drive and now we cannot hear it from the bedroom.', service: 'Opener' },
  ],
  generic: [
    { text: 'Showed up when they said, explained the options in plain language, and the final bill matched the quote.', service: 'Service call' },
    { text: 'Small local crew that actually answers the phone. We have used them three times now.', service: 'Repeat customer' },
    { text: 'Left the place cleaner than they found it. That is rare.', service: 'Project' },
  ],
};

export const sampleReviews = (trade) => SAMPLE_REVIEWS[trade] || SAMPLE_REVIEWS.generic;
