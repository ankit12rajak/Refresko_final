import { useRef, useState, useEffect } from 'react'
import { motion, useInView } from 'framer-motion'
import './TechTeam.css'

const teamMembers = [
  {
    id: 1,
    name: 'ANKIT RAJAK',
    department: 'CSE 3rd Year',
    initial: 'AR',
    color: '#E53935',
    image: '/AnkitRajak.jpeg'
  },
  {
    id: 2,
    name: 'KOUSHIK DAS',
    department: 'CSE 3rd Year',
    initial: 'KD',
    color: '#7A1FA2',
    image: '/KoushikDas.jpeg'
  },
  {
    id: 3,
    name: 'PRITAM GHOSH',
    department: 'CSE 3rd Year',
    initial: 'PG',
    color: '#FFC107',
    image: '/PritamGhosh.jpeg'
  },
  {
    id: 4,
    name: 'PRANJAL DAS',
    department: 'CYS 3rd Year',
    initial: 'PD',
    color: '#E53935',
    image: '/pranjal.webp'
  },
  {
    id: 5,
    name: 'RAJESH MONDAL',
    department: 'BCA 2nd Year',
    initial: 'RM',
    color: '#FFC107',
    image: '/RajeshMondol.jpeg'
  },
  {
    id: 6,
    name: 'ANKIT PAL',
    department: 'BCA 2nd Year',
    initial: 'AP',
    color: '#7A1FA2',
    image: '/AnkitPal.jpeg'
  },
  {
    id: 7,
    name: 'DEBANJAN DEY KABIRAJ',
    department: 'CYBER SECURITY 3rd Year',
    initial: 'DB',
    color: '#7A1FA2',
    image: '/deba.jpeg'
  }
]

const TechTeam = () => {
  const sectionRef = useRef(null)
  const scrollRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' })
  const [activeMember, setActiveMember] = useState(0)

  useEffect(() => {
    if (!isInView || teamMembers.length <= 1) {
      return
    }

    const intervalId = window.setInterval(() => {
      setActiveMember((prevIndex) => (prevIndex + 1) % teamMembers.length)
    }, 2800)

    return () => window.clearInterval(intervalId)
  }, [isInView])

  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current
      const cards = container.querySelectorAll('.team-member-card')
      if (cards[activeMember]) {
        const card = cards[activeMember]
        const containerWidth = container.offsetWidth
        const cardLeft = card.offsetLeft
        const cardWidth = card.offsetWidth
        const scrollPosition = cardLeft - (containerWidth / 2) + (cardWidth / 2)
        container.scrollTo({ left: scrollPosition, behavior: 'smooth' })
      }
    }
  }, [activeMember])

  return (
    <section id="tech-team" ref={sectionRef} className="tech-team" data-particle-shape="4">
      <div className="tech-team-header">
        <motion.span
          className="tech-team-label"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          TECH
        </motion.span>
        <motion.h2
          className="tech-team-title"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          TEAM
        </motion.h2>
      </div>

      <div className="tech-team-track-wrapper">
        <div className="tech-dotted-path">
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
            <path
              d="M0,100 Q300,20 600,100 T1200,100"
              stroke="rgba(189, 189, 189,0.45)"
              strokeWidth="2"
              strokeDasharray="8,8"
              fill="none"
            />
          </svg>
        </div>

        <div className="tech-team-scroll" ref={scrollRef}>
          <div className="tech-team-grid">
            {teamMembers.map((member, index) => (
              <motion.div
                key={member.id}
                className={`team-member-card interactive ${activeMember === index ? 'active' : ''}`}
                initial={{ opacity: 0, y: 50 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
              >
                <div className="member-role-badge">{member.role}</div>
                <div className="member-image-wrapper">
                  <div className="member-avatar-placeholder" style={{ background: `linear-gradient(135deg, ${member.color}30, ${member.color}10)` }}>
                    {member.image ? (
                      <img 
                        src={member.image} 
                        alt={member.name} 
                        className="member-photo"
                        style={{ borderColor: member.color }}
                      />
                    ) : (
                      <>
                        <span className="avatar-initial" style={{ color: member.color }}>{member.initial}</span>
                        <div className="avatar-hex-bg">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="hex" style={{ animationDelay: `${i * 0.3}s`, borderColor: `${member.color}20` }} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="member-overlay">
                    <div className="member-info">
                      <h3 className="member-name">{member.name}</h3>
                      <p className="member-role-text">{member.department}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="tech-team-indicator">
        <span className="tech-indicator-text">Refresko 2026</span>
      </div>
    </section>
  )
}

export default TechTeam
