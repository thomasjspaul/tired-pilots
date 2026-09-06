/**
 * Defined terms used across the fatigue rules, reproduced verbatim from the
 * consolidated Canadian Aviation Regulations on the Justice Laws website and
 * verified 2026-01-15. Each entry cites the section it comes from.
 *
 * CARs 101.01 holds the terms that apply across the whole regulations;
 * CARs 700.01 holds the ones specific to Subpart 700 (Division III).
 */

import { carsSectionUrl, CARS_RETRIEVED_ON } from './citations';

export interface Definition {
  term: string;
  /** Verbatim definition text (without the trailing French term). */
  text: string;
  /** "101.01" or "700.01". */
  section: string;
  /** Plain-language clarification we add — clearly not part of the regulation. */
  note?: string;
}

export const DEFINITIONS_RETRIEVED_ON = CARS_RETRIEVED_ON;
export const defUrl = (section: string) => carsSectionUrl(section);

export const DEFINITIONS: readonly Definition[] = [
  {
    term: 'flight time',
    section: '101.01',
    text: 'the time from the moment an aircraft first moves under its own power for the purpose of taking off until the moment it comes to rest at the end of the flight',
    note: 'Block time (chocks-off to chocks-on) — it includes taxi time. This is what section 700.27 limits.',
  },
  {
    term: 'air time',
    section: '101.01',
    text: 'with respect to keeping technical records, the time from the moment an aircraft leaves the surface until it comes into contact with the surface at the next point of landing',
    note: 'Wheels-up to wheels-down. Not the same as flight time, and not what the fatigue limits use.',
  },
  {
    term: 'flight duty period',
    section: '101.01',
    text: 'the period that begins when the earliest of the following events occurs and ends at engines off or rotors stopped at the end of a flight: (a) the flight crew member carries out any duties assigned by the private operator or the air operator or delegated by the Minister before reporting for a flight, (b) the member reports for a flight or, if there is more than one flight during the flight duty period, reports for the first flight, (c) the member reports for positioning, and (d) the member reports as a flight crew member on standby',
  },
  {
    term: 'fit for duty',
    section: '101.01',
    text: 'in respect of a person, means that their ability to act as a flight crew member of an aircraft is not impaired by fatigue, the consumption of alcohol or drugs or any mental or physical condition',
  },
  {
    term: 'unforeseen operational circumstance',
    section: '101.01',
    text: 'an event, such as unforecast adverse weather, or an equipment malfunction or air traffic control delay, that is beyond the control of an air operator or private operator',
    note: 'To be usable under section 700.63 it must occur within 60 minutes of the start of, or during, the flight duty period (AC 700-047 § 4.70).',
  },
  {
    term: 'positioning',
    section: '101.01',
    text: 'the transfer of a flight crew member from one location to another, at the request of an air operator, but does not include travel to or from suitable accommodation or the member’s lodging',
  },
  {
    term: 'rest period',
    section: '101.01',
    text: 'the continuous period during which a flight crew member is off duty, excluding the travel time to or from suitable accommodation provided by a private operator or air operator',
  },
  {
    term: 'home base',
    section: '101.01',
    text: 'the location where a flight crew member normally commutes to in order to report for a flight duty period or positioning',
  },
  {
    term: 'suitable accommodation',
    section: '101.01',
    text: 'a single-occupancy bedroom that is subject to a minimal level of noise, is well ventilated and has facilities to control the levels of temperature and light or, where such a bedroom is not available, an accommodation that is suitable for the site and season, is subject to a minimal level of noise and provides adequate comfort and protection from the elements',
  },
  {
    term: 'acclimatized',
    section: '700.01',
    text: 'describes a flight crew member whose biorhythm is aligned with local time',
    note: 'Section 700.28(5) sets out how much time in a zone counts as acclimatized; AC 700-047 §§ 4.22–4.26 explain how it is applied.',
  },
  {
    term: 'early duty',
    section: '700.01',
    text: 'hours of work that begin between 02:00 and 06:59 at the location where the flight crew member is acclimatized',
  },
  {
    term: 'late duty',
    section: '700.01',
    text: 'hours of work that end between midnight and 01:59 at the location where the flight crew member is acclimatized',
  },
  {
    term: 'night duty',
    section: '700.01',
    text: 'hours of work that begin between 13:00 and 01:59 and that end after 01:59 at a location where the flight crew member is acclimatized',
  },
  {
    term: 'local night’s rest',
    section: '700.01',
    text: 'a rest period of at least nine hours that takes place between 22:30 and 09:30 at the location where the flight crew member is acclimatized',
  },
  {
    term: 'single day free from duty',
    section: '700.01',
    text: 'time free from duty from the beginning of the first local night’s rest until the end of the following local night’s rest',
  },
  {
    term: 'window of circadian low',
    section: '700.01',
    text: 'the period that begins at 02:00 and ends at 05:59 at the location where the flight crew member is acclimatized',
  },
  {
    term: 'flight crew member on reserve',
    section: '700.01',
    text: 'a flight crew member who has been designated by an air operator to be available to report for flight duty on notice of more than one hour',
    note: 'A flight crew member on standby is available on one hour’s notice or less.',
  },
  {
    term: 'reserve availability period',
    section: '700.01',
    text: 'the period in any period of 24 consecutive hours during which a flight crew member on reserve is available to report for flight duty',
  },
  {
    term: 'reserve duty period',
    section: '700.01',
    text: 'the period that begins at the time that a flight crew member on reserve is available to report for flight duty and ends at the time that the flight duty period ends',
  },
  {
    term: 'class 1 rest facility',
    section: '700.01',
    text: 'a bunk or other horizontal surface located in an area that (a) is separated from the flight deck and passenger cabin, (b) has devices to control the temperature and light, and (c) is subject to a minimal level of noise and other disturbances',
  },
  {
    term: 'class 2 rest facility',
    section: '700.01',
    text: 'a seat that allows for a horizontal sleeping position in an area that (a) is separated from passengers by a curtain or other means of separation that reduces light and sound, (b) is equipped with portable oxygen equipment, and (c) minimizes disturbances by passengers and crew members',
  },
  {
    term: 'class 3 rest facility',
    section: '700.01',
    text: 'a seat that reclines at least 40° from vertical and that has leg and foot support',
  },
] as const;
