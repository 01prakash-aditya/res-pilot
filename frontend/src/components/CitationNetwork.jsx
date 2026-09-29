import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import api from '../api';

export default function CitationNetwork({ docId, filename }) {
  const containerRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/citations/${docId}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [docId]);

  useEffect(() => {
    if (!data || !data.references || !containerRef.current) return;
    
    d3.select(containerRef.current).selectAll("*").remove();
    
    const width = containerRef.current.clientWidth;
    const height = 600;

    const nodes = [
      { id: 'root', title: filename, isRoot: true, year: new Date().getFullYear(), radius: 25 },
      ...data.references.map((ref, i) => ({
        id: `ref-${i}`,
        title: ref.title,
        authors: ref.authors,
        year: ref.year,
        doi: ref.doi_or_url,
        isRoot: false,
        radius: 12
      }))
    ];

    const links = data.references.map((ref, i) => ({
      source: 'root',
      target: `ref-${i}`,
      value: 1
    }));

    const colorScale = d3.scaleSequential(d3.interpolateViridis)
                         .domain([1990, new Date().getFullYear()]);

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .call(d3.zoom().scaleExtent([0.1, 4]).on("zoom", (e) => {
        g.attr("transform", e.transform);
      }));

    const g = svg.append("g");
    
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(d => d.radius + 8));

    const link = g.append("g")
      .attr("stroke", "rgba(255,255,255,0.15)")
      .attr("stroke-opacity", 0.8)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value));

    const tooltip = d3.select("body").append("div")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "var(--bg-elevated)")
      .style("border", "1px solid var(--border)")
      .style("padding", "10px 14px")
      .style("border-radius", "8px")
      .style("color", "var(--text-primary)")
      .style("font-size", "13px")
      .style("max-width", "320px")
      .style("z-index", "1000")
      .style("pointer-events", "none")
      .style("box-shadow", "0 10px 25px rgba(0,0,0,0.5)");

    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => d.isRoot ? "var(--accent)" : colorScale(d.year || 2000))
      .attr("cursor", d => d.isRoot ? "default" : "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("mouseover", (event, d) => {
        tooltip.html(`
          <div style="font-weight: 600; margin-bottom: 6px; line-height: 1.3;">${d.title}</div>
          ${d.authors ? `<div style="color: var(--text-secondary); font-size: 11px; margin-bottom: 4px;">${d.authors}</div>` : ''}
          ${d.year ? `<div style="color: var(--accent); font-weight: bold; font-size: 12px;">${d.year}</div>` : ''}
          ${!d.isRoot ? `<div style="color: #6ee7b7; font-size: 10px; margin-top: 6px;">Click to search or open</div>` : ''}
        `);
        tooltip.style("visibility", "visible");
        d3.select(event.currentTarget).attr("stroke", "var(--accent)").attr("stroke-width", 3);
      })
      .on("mousemove", (event) => {
        tooltip.style("top", (event.pageY + 15) + "px").style("left", (event.pageX + 15) + "px");
      })
      .on("mouseout", (event) => {
        tooltip.style("visibility", "hidden");
        d3.select(event.currentTarget).attr("stroke", "#fff").attr("stroke-width", 1.5);
      })
      .on("click", (event, d) => {
        if (event.defaultPrevented) return;
        if (!d.isRoot) {
          const url = (d.doi && d.doi.startsWith('http')) ? d.doi : 
                      (d.doi ? `https://doi.org/${d.doi}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(d.title)}`);
          window.open(url, '_blank');
        }
      });

    const labels = g.append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text(d => d.isRoot ? "Paper" : (d.year ? String(d.year) : ""))
      .attr("font-size", d => d.isRoot ? "11px" : "9px")
      .attr("font-weight", "600")
      .attr("fill", "white")
      .attr("text-anchor", "middle")
      .attr("dy", d => d.isRoot ? 4 : 3)
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
      labels
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      tooltip.remove();
      simulation.stop();
    };

  }, [data, filename]);

  if (loading) return <div className="p-10 flex justify-center w-full"><div className="spinner"></div></div>;
  if (!data || !data.references || data.references.length === 0) {
    return (
      <div className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-10 flex flex-col items-center text-center">
        <p className="text-[15px] font-medium text-[var(--text-secondary)]">No citations extracted.</p>
        <p className="text-[13px] text-[var(--text-muted)] mt-2">Could not find a standard references section in this PDF.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 bg-[rgba(18,26,54,0.8)] backdrop-blur-md border border-[var(--border)] px-4 py-3 rounded-lg shadow-[var(--shadow-md)] pointer-events-none">
        <h3 className="font-semibold text-[14px] text-white">Citation Network</h3>
        <p className="text-[12px] text-[var(--accent)] font-medium mt-0.5">{data.references.length} references extracted</p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-2">Scroll to zoom, drag to pan.<br/>Click nodes with DOI to open.</p>
      </div>
      <div ref={containerRef} className="w-full h-[600px] cursor-grab active:cursor-grabbing bg-[rgba(0,0,0,0.2)]"></div>
    </div>
  );
}
