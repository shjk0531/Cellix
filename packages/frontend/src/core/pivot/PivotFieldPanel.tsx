import React, { useState, useCallback } from "react";
import {
    DndContext,
    DragOverlay,
    useDroppable,
    type DragEndEvent,
    type DragStartEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
    PivotDefinition,
    PivotField,
    PivotValueField,
    AggregationType,
} from "./types";

// ── Zone types ───────────────────────────────────────────────────────────────

type ZoneId = "available" | "filters" | "columns" | "rows" | "values";

const ZONE_LABELS: Record<ZoneId, string> = {
    available: "사용 가능한 필드",
    filters: "필터",
    columns: "열",
    rows: "행",
    values: "값",
};

const AGG_OPTIONS: { value: AggregationType; label: string }[] = [
    { value: "sum", label: "합계" },
    { value: "count", label: "개수" },
    { value: "average", label: "평균" },
    { value: "max", label: "최대값" },
    { value: "min", label: "최소값" },
    { value: "countNumbers", label: "숫자 개수" },
    { value: "product", label: "곱" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFieldZone(fieldName: string, def: PivotDefinition): ZoneId {
    if (def.filterFields.some((f) => f.fieldName === fieldName))
        return "filters";
    if (def.colFields.some((f) => f.fieldName === fieldName)) return "columns";
    if (def.rowFields.some((f) => f.fieldName === fieldName)) return "rows";
    if (def.valueFields.some((f) => f.fieldName === fieldName)) return "values";
    return "available";
}

function getZoneFieldNames(def: PivotDefinition, zone: ZoneId): string[] {
    switch (zone) {
        case "filters":
            return def.filterFields.map((f) => f.fieldName);
        case "columns":
            return def.colFields.map((f) => f.fieldName);
        case "rows":
            return def.rowFields.map((f) => f.fieldName);
        case "values":
            return def.valueFields.map((f) => f.fieldName);
        default:
            return [];
    }
}

function removeFromZone(
    def: PivotDefinition,
    fieldName: string,
    zone: ZoneId,
): PivotDefinition {
    switch (zone) {
        case "filters":
            return {
                ...def,
                filterFields: def.filterFields.filter(
                    (f) => f.fieldName !== fieldName,
                ),
            };
        case "columns":
            return {
                ...def,
                colFields: def.colFields.filter(
                    (f) => f.fieldName !== fieldName,
                ),
            };
        case "rows":
            return {
                ...def,
                rowFields: def.rowFields.filter(
                    (f) => f.fieldName !== fieldName,
                ),
            };
        case "values":
            return {
                ...def,
                valueFields: def.valueFields.filter(
                    (f) => f.fieldName !== fieldName,
                ),
            };
        default:
            return def;
    }
}

function addToZone(
    def: PivotDefinition,
    fieldName: string,
    zone: ZoneId,
): PivotDefinition {
    const field: PivotField = { fieldName };
    switch (zone) {
        case "filters":
            return { ...def, filterFields: [...def.filterFields, field] };
        case "columns":
            return { ...def, colFields: [...def.colFields, field] };
        case "rows":
            return { ...def, rowFields: [...def.rowFields, field] };
        case "values": {
            const vf: PivotValueField = { fieldName, aggregation: "sum" };
            return { ...def, valueFields: [...def.valueFields, vf] };
        }
        default:
            return def;
    }
}

function reorderZone(
    def: PivotDefinition,
    zone: ZoneId,
    oldIdx: number,
    newIdx: number,
): PivotDefinition {
    switch (zone) {
        case "filters":
            return {
                ...def,
                filterFields: arrayMove(def.filterFields, oldIdx, newIdx),
            };
        case "columns":
            return {
                ...def,
                colFields: arrayMove(def.colFields, oldIdx, newIdx),
            };
        case "rows":
            return {
                ...def,
                rowFields: arrayMove(def.rowFields, oldIdx, newIdx),
            };
        case "values":
            return {
                ...def,
                valueFields: arrayMove(def.valueFields, oldIdx, newIdx),
            };
        default:
            return def;
    }
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface SortableItemProps {
    id: string;
    zone: ZoneId;
    label: string;
    children?: React.ReactNode;
}

function SortableItem({ id, zone, label, children }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        data: { zone },
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                display: "flex",
                alignItems: "center",
                padding: "3px 6px",
                margin: "2px 0",
                background: "#ffffff",
                border: "1px solid #d1d5db",
                borderRadius: 4,
                opacity: isDragging ? 0.4 : 1,
                fontSize: 12,
                userSelect: "none",
                transform: CSS.Transform.toString(transform),
                transition,
            }}
        >
            <span
                {...attributes}
                {...listeners}
                style={{
                    flex: 1,
                    cursor: "grab",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                }}
            >
                ⠿ {label}
            </span>
            {children}
        </div>
    );
}

interface DroppableZoneProps {
    id: ZoneId;
    label: string;
    itemIds: string[];
    children: React.ReactNode;
}

function DroppableZone({ id, label, itemIds, children }: DroppableZoneProps) {
    const { setNodeRef, isOver } = useDroppable({ id, data: { zone: id } });

    return (
        <div style={{ marginBottom: 8 }}>
            {label && (
                <div
                    style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#6b7280",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        marginBottom: 4,
                    }}
                >
                    {label}
                </div>
            )}
            <div
                ref={setNodeRef}
                style={{
                    minHeight: 50,
                    background: isOver ? "#eff6ff" : "#f9fafb",
                    border: `1px dashed ${isOver ? "#3b82f6" : "#d1d5db"}`,
                    borderRadius: 6,
                    padding: "4px",
                    transition: "background 0.1s, border-color 0.1s",
                }}
            >
                <SortableContext
                    items={itemIds}
                    strategy={verticalListSortingStrategy}
                >
                    {children}
                </SortableContext>
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

export interface PivotFieldPanelProps {
    definition: PivotDefinition;
    availableFields: string[];
    onUpdate: (def: PivotDefinition) => void;
}

export function PivotFieldPanel({
    definition,
    availableFields,
    onUpdate,
}: PivotFieldPanelProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const usedFields = new Set([
        ...definition.filterFields.map((f) => f.fieldName),
        ...definition.colFields.map((f) => f.fieldName),
        ...definition.rowFields.map((f) => f.fieldName),
        ...definition.valueFields.map((f) => f.fieldName),
    ]);

    const unusedFields = availableFields.filter((f) => !usedFields.has(f));

    const handleDragStart = useCallback(({ active }: DragStartEvent) => {
        setActiveId(String(active.id));
    }, []);

    const handleDragEnd = useCallback(
        ({ active, over }: DragEndEvent) => {
            setActiveId(null);
            if (!over) return;

            const fieldName = String(active.id);
            const targetZone = (over.data.current?.zone ??
                String(over.id)) as ZoneId;
            const sourceZone = getFieldZone(fieldName, definition);

            if (sourceZone === targetZone) {
                // Same zone: reorder
                if (sourceZone === "available") return;
                const names = getZoneFieldNames(definition, sourceZone);
                const oldIdx = names.indexOf(fieldName);
                const newIdx = names.indexOf(String(over.id));
                if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
                    onUpdate(
                        reorderZone(definition, sourceZone, oldIdx, newIdx),
                    );
                }
                return;
            }

            // Cross-zone move
            let newDef =
                sourceZone !== "available"
                    ? removeFromZone(definition, fieldName, sourceZone)
                    : definition;
            newDef = addToZone(newDef, fieldName, targetZone);
            onUpdate(newDef);
        },
        [definition, onUpdate],
    );

    const handleAggChange = (fieldName: string, agg: AggregationType) => {
        onUpdate({
            ...definition,
            valueFields: definition.valueFields.map((f) =>
                f.fieldName === fieldName ? { ...f, aggregation: agg } : f,
            ),
        });
    };

    const handleRemove = (
        fieldName: string,
        zone: Exclude<ZoneId, "available">,
    ) => {
        onUpdate(removeFromZone(definition, fieldName, zone));
    };

    const filterIds = definition.filterFields.map((f) => f.fieldName);
    const colIds = definition.colFields.map((f) => f.fieldName);
    const rowIds = definition.rowFields.map((f) => f.fieldName);
    const valueIds = definition.valueFields.map((f) => f.fieldName);

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div
                style={{
                    width: 224,
                    padding: 12,
                    background: "#f3f4f6",
                    borderLeft: "1px solid #e5e7eb",
                    overflowY: "auto",
                    height: "100%",
                    boxSizing: "border-box",
                    fontFamily: "inherit",
                }}
            >
                {/* Available fields */}
                <div style={{ marginBottom: 12 }}>
                    <div
                        style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#374151",
                            marginBottom: 6,
                        }}
                    >
                        {ZONE_LABELS.available}
                    </div>
                    <DroppableZone
                        id="available"
                        label=""
                        itemIds={unusedFields}
                    >
                        {unusedFields.length === 0 ? (
                            <div
                                style={{
                                    fontSize: 11,
                                    color: "#9ca3af",
                                    padding: "8px 6px",
                                    textAlign: "center",
                                }}
                            >
                                모든 필드 사용 중
                            </div>
                        ) : (
                            unusedFields.map((f) => (
                                <SortableItem
                                    key={f}
                                    id={f}
                                    zone="available"
                                    label={f}
                                />
                            ))
                        )}
                    </DroppableZone>
                </div>

                <hr
                    style={{
                        border: "none",
                        borderTop: "1px solid #d1d5db",
                        marginBottom: 12,
                    }}
                />

                {/* Filter zone */}
                <DroppableZone
                    id="filters"
                    label={ZONE_LABELS.filters}
                    itemIds={filterIds}
                >
                    {definition.filterFields.map((f) => (
                        <SortableItem
                            key={f.fieldName}
                            id={f.fieldName}
                            zone="filters"
                            label={f.displayName ?? f.fieldName}
                        >
                            <button
                                onClick={() =>
                                    handleRemove(f.fieldName, "filters")
                                }
                                onPointerDown={(e) => e.stopPropagation()}
                                style={removeBtn}
                            >
                                ×
                            </button>
                        </SortableItem>
                    ))}
                </DroppableZone>

                {/* Column zone */}
                <DroppableZone
                    id="columns"
                    label={ZONE_LABELS.columns}
                    itemIds={colIds}
                >
                    {definition.colFields.map((f) => (
                        <SortableItem
                            key={f.fieldName}
                            id={f.fieldName}
                            zone="columns"
                            label={f.displayName ?? f.fieldName}
                        >
                            <button
                                onClick={() =>
                                    handleRemove(f.fieldName, "columns")
                                }
                                onPointerDown={(e) => e.stopPropagation()}
                                style={removeBtn}
                            >
                                ×
                            </button>
                        </SortableItem>
                    ))}
                </DroppableZone>

                {/* Row zone */}
                <DroppableZone
                    id="rows"
                    label={ZONE_LABELS.rows}
                    itemIds={rowIds}
                >
                    {definition.rowFields.map((f) => (
                        <SortableItem
                            key={f.fieldName}
                            id={f.fieldName}
                            zone="rows"
                            label={f.displayName ?? f.fieldName}
                        >
                            <button
                                onClick={() =>
                                    handleRemove(f.fieldName, "rows")
                                }
                                onPointerDown={(e) => e.stopPropagation()}
                                style={removeBtn}
                            >
                                ×
                            </button>
                        </SortableItem>
                    ))}
                </DroppableZone>

                {/* Values zone */}
                <DroppableZone
                    id="values"
                    label={ZONE_LABELS.values}
                    itemIds={valueIds}
                >
                    {definition.valueFields.map((f) => (
                        <SortableItem
                            key={f.fieldName}
                            id={f.fieldName}
                            zone="values"
                            label={f.displayName ?? f.fieldName}
                        >
                            <select
                                value={f.aggregation}
                                onChange={(e) =>
                                    handleAggChange(
                                        f.fieldName,
                                        e.target.value as AggregationType,
                                    )
                                }
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                style={{
                                    fontSize: 10,
                                    marginLeft: 4,
                                    maxWidth: 60,
                                    border: "1px solid #d1d5db",
                                    borderRadius: 3,
                                    padding: "1px 2px",
                                    flexShrink: 0,
                                }}
                            >
                                {AGG_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() =>
                                    handleRemove(f.fieldName, "values")
                                }
                                onPointerDown={(e) => e.stopPropagation()}
                                style={removeBtn}
                            >
                                ×
                            </button>
                        </SortableItem>
                    ))}
                </DroppableZone>
            </div>

            <DragOverlay>
                {activeId ? (
                    <div
                        style={{
                            padding: "3px 10px",
                            background: "#dbeafe",
                            border: "1px solid #3b82f6",
                            borderRadius: 4,
                            fontSize: 12,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                            cursor: "grabbing",
                            userSelect: "none",
                        }}
                    >
                        ⠿ {activeId}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

const removeBtn: React.CSSProperties = {
    marginLeft: 4,
    padding: "0 4px",
    fontSize: 14,
    lineHeight: 1,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#6b7280",
    flexShrink: 0,
};
