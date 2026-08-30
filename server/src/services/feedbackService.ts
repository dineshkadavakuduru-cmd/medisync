import { PatientFeedback, FeedbackSummary } from '../types/index.js';
import { mockFacilities } from '../database/facilities.js';

const TAGS = [
  'helpful_staff',
  'good_doctor',
  'clean_facility',
  'medicine_available',
  'short_wait',
  'long_wait',
  'no_medicine',
  'poor_hygiene',
  'rude_staff',
];

const POSITIVE_TAGS = ['helpful_staff', 'good_doctor', 'clean_facility', 'medicine_available', 'short_wait'];
const NEGATIVE_TAGS = ['long_wait', 'no_medicine', 'poor_hygiene', 'rude_staff'];

const COMMENTS: Record<string, string[]> = {
  en: ['Very good service', 'Had to wait too long', 'Staff was helpful', 'Medicine was not available', 'Clean and organized', 'Doctor was very nice', 'Poor hygiene in waiting area', 'Rude behavior from staff'],
  hi: ['बहुत अच्छा सेवा', 'बहुत इंतज़ार करना पड़ा', 'स्टाफ सहायक था', 'दवा उपलब्ध नहीं थी', 'साफ और व्यवस्थित', 'डॉक्टर बहुत अच्छे थे', 'प्रतीक्षा क्षेत्र में खराब सफाई', 'स्टाफ की अशिष्ट व्यवहार'],
  mr: ['खूप चांगली सेवा', 'खूप प्रतीक्षा करावी लागली', 'कर्मचारी मदतगार होता', 'औषध उपलब्ध नव्हते', 'स्वतःच आणि व्यवस्थित', 'डॉक्टर खूप चांगले होते', 'प्रतीक्षा क्षेत्रात खराब स्वच्छता', 'कर्मचारीची अपमानजनक वागणूक'],
};

function randomDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
}

let feedbackIdCounter = 1;

export function getMockFeedback(): PatientFeedback[] {
  const feedback: PatientFeedback[] = [];
  const languages: Array<'en' | 'hi' | 'mr'> = ['en', 'hi', 'mr'];

  for (let i = 0; i < 38; i++) {
    const facility = mockFacilities[Math.floor(Math.random() * mockFacilities.length)];
    const lang = languages[Math.floor(Math.random() * languages.length)];
    const ratingPool = [5, 5, 4, 4, 4, 3, 3, 3, 2, 1];
    const rating = ratingPool[Math.floor(Math.random() * ratingPool.length)] as 1 | 2 | 3 | 4 | 5;
    const tagCount = Math.floor(Math.random() * 3) + 1;
    const selectedTags: string[] = [];
    if (rating >= 4) {
      const posTags = POSITIVE_TAGS.filter(() => Math.random() > 0.4);
      selectedTags.push(...posTags.slice(0, tagCount));
    } else if (rating <= 2) {
      const negTags = NEGATIVE_TAGS.filter(() => Math.random() > 0.4);
      selectedTags.push(...negTags.slice(0, tagCount));
    } else {
      const mixed = [...TAGS].sort(() => Math.random() - 0.5).slice(0, tagCount);
      selectedTags.push(...mixed);
    }

    const comments = COMMENTS[lang];
    const comment = comments[Math.floor(Math.random() * comments.length)];

    feedback.push({
      id: `feedback-${feedbackIdCounter++}`,
      patientId: Math.random() > 0.3 ? `patient-${Math.floor(Math.random() * 50) + 1}` : undefined,
      facilityId: facility.id,
      visitDate: randomDate(30),
      rating,
      tags: [...new Set(selectedTags)],
      comment,
      language: lang,
    });
  }

  return feedback.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
}

const mockFeedbackStore = getMockFeedback();

export function getAllFeedback(facilityId?: string): PatientFeedback[] {
  if (facilityId) {
    return mockFeedbackStore.filter((f) => f.facilityId === facilityId);
  }
  return mockFeedbackStore;
}

export function addFeedback(feedback: Omit<PatientFeedback, 'id'>): PatientFeedback {
  const newFeedback: PatientFeedback = {
    ...feedback,
    id: `feedback-${feedbackIdCounter++}`,
  };
  mockFeedbackStore.unshift(newFeedback);
  return newFeedback;
}

export function getFeedbackSummary(): FeedbackSummary {
  const all = mockFeedbackStore;
  const total = all.length;
  const avgRating = total > 0 ? Math.round((all.reduce((sum, f) => sum + f.rating, 0) / total) * 10) / 10 : 0;

  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  all.forEach((f) => {
    ratingDistribution[f.rating]++;
  });

  const tagCounts: Record<string, number> = {};
  all.forEach((f) => {
    f.tags.forEach((tag) => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  const topPositiveTags = sortedTags
    .filter(([tag]) => POSITIVE_TAGS.includes(tag))
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const topNegativeTags = sortedTags
    .filter(([tag]) => NEGATIVE_TAGS.includes(tag))
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const facilityStats: Record<string, { sum: number; count: number; name: string }> = {};
  all.forEach((f) => {
    if (!facilityStats[f.facilityId]) {
      facilityStats[f.facilityId] = { sum: 0, count: 0, name: mockFacilities.find((m) => m.id === f.facilityId)?.name || f.facilityId };
    }
    facilityStats[f.facilityId].sum += f.rating;
    facilityStats[f.facilityId].count++;
  });

  const byFacility = Object.entries(facilityStats).map(([facilityId, stats]) => ({
    facilityId,
    facilityName: stats.name,
    avgRating: Math.round((stats.sum / stats.count) * 10) / 10,
    feedbackCount: stats.count,
  }));

  return {
    avgRating,
    totalFeedback: total,
    ratingDistribution,
    topPositiveTags,
    topNegativeTags,
    byFacility,
  };
}