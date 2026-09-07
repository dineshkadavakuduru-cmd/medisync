'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function WelcomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="welcome-page">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/95 backdrop-blur-md shadow-md' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#00695C] flex items-center justify-center">
              <span className="text-white text-lg">🏥</span>
            </div>
            <span className="text-xl font-bold text-[#00695C]">MediSync</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium hover:text-[#00695C] transition-colors" style={{ color: scrolled ? '#757575' : 'rgba(255,255,255,0.9)' }}>Features</a>
            <a href="#tech" className="text-sm font-medium hover:text-[#00695C] transition-colors" style={{ color: scrolled ? '#757575' : 'rgba(255,255,255,0.9)' }}>Tech Stack</a>
            <a href="#impact" className="text-sm font-medium hover:text-[#00695C] transition-colors" style={{ color: scrolled ? '#757575' : 'rgba(255,255,255,0.9)' }}>Impact</a>
            <Link href="/login" className="px-4 py-2 bg-white text-[#00695C] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm">
              Sign In / Select Role →
            </Link>
          </div>
          <div className="md:hidden">
            <Link href="/login" className="px-3 py-1.5 bg-white text-[#00695C] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm">
              Sign In →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #00695C 0%, #004D40 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Bridging Rural Healthcare with AI
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-3xl mx-auto leading-relaxed">
            A unified platform connecting Sub-Centres, PHCs, CHCs & District Hospitals — powered by AI triage, real-time monitoring, and offline-first design
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="px-8 py-3.5 bg-white text-[#00695C] rounded-xl text-base font-bold hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl">
              Sign In / Select Role →
            </Link>
            <a href="https://sih.gov.in" target="_blank" rel="noopener noreferrer" className="px-8 py-3.5 border-2 border-white text-white rounded-xl text-base font-bold hover:bg-white/10 transition-all">
              View Problem Statement ↗
            </a>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#212121] mb-4">The Crisis in Rural Healthcare</h2>
            <p className="text-[#757575] max-w-2xl mx-auto">Rural India faces a critical healthcare gap. Here&apos;s the reality:</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { number: '78%', text: 'Specialist positions vacant in rural CHCs' },
              { number: '40%', text: 'Referral drop-off rate' },
              { number: '57%', text: 'Rural patients travel 30+ km for basic care' },
              { number: '80%+', text: 'Sub-centres with zero digital records' },
            ].map((stat, i) => (
              <div key={i} className="text-center p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="text-5xl font-bold text-[#C62828] mb-3">{stat.number}</div>
                <div className="text-[#757575] text-sm leading-relaxed">{stat.text}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[#757575] mt-8 opacity-60">Source: Rural Health Statistics 2021-22, MoHFW, Government of India</p>
        </div>
      </section>

      {/* Solution Section */}
      <section id="features" className="py-20 bg-[#F5F5F5]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#212121] mb-4">How MediSync Solves This</h2>
            <p className="text-[#757575] max-w-2xl mx-auto">Comprehensive solutions designed for the unique challenges of rural healthcare delivery.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '📋', title: 'Unified Health Records', desc: 'ABHA-linked digital health records accessible across the entire care continuum.' },
              { icon: '🤖', title: 'AI-Powered Triage', desc: 'Intelligent symptom analysis for faster, more accurate clinical decisions.' },
              { icon: '🗺️', title: 'Smart Referral Routing', desc: 'GIS-based routing to find the nearest appropriate facility in real-time.' },
              { icon: '🚨', title: 'Emergency Escalation', desc: 'One-tap SOS with automated escalation to district command centres.' },
              { icon: '📊', title: 'Predictive Analytics', desc: 'Disease outbreak detection using real-time surveillance data.' },
              { icon: '🗣️', title: 'Voice-First, Multilingual', desc: 'Full Hindi, Marathi, and English support for accessibility.' },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border border-gray-100"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-bold text-[#212121] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#757575] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section id="tech" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#212121] mb-4">Built with Modern Technology</h2>
            <p className="text-[#757575] max-w-2xl mx-auto">A robust, scalable tech stack engineered for reliability in challenging connectivity environments.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['React Native', 'Next.js', 'Node.js', 'PostgreSQL', 'TensorFlow Lite', 'Gemini AI', 'WebSocket', 'ABDM/FHIR'].map((tech) => (
              <span key={tech} className="px-5 py-2.5 bg-gray-100 text-[#212121] rounded-full text-sm font-medium hover:bg-[#00695C] hover:text-white transition-colors cursor-default">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="impact" className="py-20 bg-[#00695C]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Measurable Impact</h2>
            <p className="text-white/70 max-w-2xl mx-auto">Projected outcomes that will transform rural healthcare delivery.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { number: '95%+', text: 'Referral Completion' },
              { number: '<15 min', text: 'Emergency Response Time' },
              { number: '100%', text: 'Record Digitization' },
              { number: '₹5,000', text: 'Saved per patient' },
            ].map((metric, i) => (
              <div key={i} className="text-center p-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <div className="text-4xl md:text-5xl font-bold text-white mb-3">{metric.number}</div>
                <div className="text-white/80 text-sm">{metric.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-[#F5F5F5]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#212121] mb-4">Built for SIH 2026</h2>
          <div className="space-y-2 mb-8">
            <p className="text-[#00695C] font-semibold text-lg">PS26133 — Government of Maharashtra</p>
            <p className="text-[#757575]">Theme: MedTech / BioTech / HealthTech</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Team Lead', 'Backend Engineer', 'Frontend Engineer', 'ML Engineer'].map((role) => (
              <div key={role} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="w-12 h-12 rounded-full bg-[#E0F2F1] flex items-center justify-center mx-auto mb-2 text-xl">👤</div>
                <div className="text-xs text-[#757575] font-medium">{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#212121] py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-white/60 text-sm">
            MediSync © 2026 | SIH 2026 — PS26133 | Government of Maharashtra
          </p>
        </div>
      </footer>
    </div>
  );
}
