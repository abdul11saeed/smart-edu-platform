export interface ContentItem {
    id: string;
    name: string;
    type: 'university' | 'college' | 'major' | 'course';
    status: 'active' | 'inactive';
    parentId?: string;
}
