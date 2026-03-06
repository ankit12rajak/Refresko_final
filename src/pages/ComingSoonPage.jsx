import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CustomCursor from '../components/CustomCursor/CustomCursor'
import './ComingSoonPage.css'

const ComingSoonPage = ({ title, subtitle, launchLine }) => {
	const isEventsPage = title?.toLowerCase() === 'events'
	const pdfPath = useMemo(() => '/Refresko%202026%20Rule%20Book.pdf', [])
	const [currentPage, setCurrentPage] = useState(1)
	const [displayPage, setDisplayPage] = useState(1)
	const [isFlipping, setIsFlipping] = useState(false)
	const [flipDirection, setFlipDirection] = useState('next')
	const [isPdfLoaded, setIsPdfLoaded] = useState(false)
	const pdfViewerSrc = useMemo(
		() => `${pdfPath}#toolbar=0&navpanes=0&scrollbar=0&page=${displayPage}&view=FitH`,
		[pdfPath, displayPage]
	)

	useEffect(() => {
		if (!isEventsPage) {
			return undefined
		}

		const preloadLink = document.createElement('link')
		preloadLink.rel = 'preload'
		preloadLink.as = 'fetch'
		preloadLink.href = pdfPath
		preloadLink.type = 'application/pdf'

		const prefetchLink = document.createElement('link')
		prefetchLink.rel = 'prefetch'
		prefetchLink.href = pdfPath
		prefetchLink.type = 'application/pdf'

		document.head.appendChild(preloadLink)
		document.head.appendChild(prefetchLink)

		return () => {
			document.head.removeChild(preloadLink)
			document.head.removeChild(prefetchLink)
		}
	}, [isEventsPage, pdfPath])

	const handleFlipPage = (direction) => {
		if (isFlipping) {
			return
		}

		if (direction === 'prev' && currentPage <= 1) {
			return
		}

		const targetPage = direction === 'next' ? currentPage + 1 : currentPage - 1
		setFlipDirection(direction)
		setIsFlipping(true)
		setIsPdfLoaded(false)

		window.setTimeout(() => {
			setDisplayPage(targetPage)
			setCurrentPage(targetPage)
		}, 360)

		window.setTimeout(() => {
			setIsFlipping(false)
		}, 760)
	}

	return (
		<div className="coming-soon">
			<CustomCursor />
			<div className="hex-grid-overlay" />

			<header className="coming-soon-header">
				<div className="coming-soon-logo">
					<span className="logo-main">REFRESKO</span>
					<span className="logo-year">2026</span>
				</div>
				<Link className="coming-soon-link interactive" to="/">
					BACK TO HOME
				</Link>
			</header>

			<main className={`coming-soon-main ${isEventsPage ? 'events-only-main' : ''}`}>
				{isEventsPage && (
					<motion.h1
						className="events-page-heading"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.15 }}
					>
						EVENTS
					</motion.h1>
				)}
				{!isEventsPage && (
					<>
						<motion.div
							className="coming-soon-badge"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6 }}
						>
							SUPREME KNOWLEDGE FOUNDATION
						</motion.div>

						<motion.h1
							className="coming-soon-title"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.1 }}
						>
							{title}
							<span className="title-accent">COMING SOON</span>
						</motion.h1>

						<motion.p
							className="coming-soon-subtitle"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.2 }}
						>
							{subtitle}
						</motion.p>
					</>
				)}

				{isEventsPage && (
					<motion.div
						className="coming-soon-banner"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.25 }}
					>
						<img
							className="coming-soon-banner-image"
							src="/event%20banner.png"
							alt="Events banner"
							loading="lazy"
							decoding="async"
						/>
					</motion.div>
				)}

				{isEventsPage && (
					<motion.section
						className="rulebook-section"
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.35 }}
					>
						<div className="rulebook-header">
							<h2 className="rulebook-title">Refresko 2026 Rule Book</h2>
							
						</div>

						<div className="rulebook-book-shell">
							<div className="rulebook-spine" aria-hidden="true" />
							<div className={`rulebook-page-surface ${isFlipping ? `is-flipping ${flipDirection}` : ''}`}>
								{!isPdfLoaded && (
									<div className="rulebook-loading-state" role="status" aria-live="polite">
										<div className="rulebook-loading-spinner" aria-hidden="true" />
										<p>Loading rule book...</p>
									</div>
								)}
								<iframe
									title="Refresko 2026 Rule Book"
									className="rulebook-frame"
									src={pdfViewerSrc}
									loading="eager"
									onLoad={() => setIsPdfLoaded(true)}
								/>
								<div className="rulebook-page-shadow" aria-hidden="true" />
							</div>
						</div>

						<div className="rulebook-controls">
							
							<a className="rulebook-download-btn interactive" href={pdfPath} download>
								Download Rule Book
							</a>
						</div>
					</motion.section>
				)}

				{!isEventsPage && (
					<>
						<motion.div
							className="coming-soon-launch"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.3 }}
						>
							<span className="launch-label">LAUNCH WINDOW</span>
							<span className="launch-value neon-text">{launchLine}</span>
						</motion.div>

						<motion.form
							className="coming-soon-form"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.4 }}
							onSubmit={(event) => event.preventDefault()}
						>
							<input
								className="coming-soon-input"
								type="email"
								name="email"
								placeholder="Enter your email for early access"
								autoComplete="email"
							/>
							<button className="coming-soon-button interactive" type="submit">
								JOIN WAITLIST
							</button>
						</motion.form>
					</>
				)}

				<motion.div
					className="coming-soon-actions"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.5 }}
				>
					{isEventsPage && (
						<a
							className="btn-outline register-now-btn interactive"
							href="https://forms.gle/R9icZUxEevYpWe6L8"
							target="_blank"
							rel="noopener noreferrer"
						>
							REGISTER NOW
							<span className="btn-arrow">→</span>
						</a>
					)}
					{!isEventsPage && (
						<Link className="btn-outline interactive" to="/">
							RETURN TO REFRESKO
							<span className="btn-arrow">→</span>
						</Link>
					)}
				</motion.div>
			</main>

			<div className="coming-soon-atmosphere">
				<span className="glow-orb orb-one" />
				<span className="glow-orb orb-two" />
				<span className="signal-line" />
				<span className="signal-line" />
				<span className="signal-line" />
			</div>
		</div>
	)
}

export default ComingSoonPage
