import DiscussionForum from '../discussion/DiscussionForum';

interface DiscussionsTabProps {
  courseId: string;
}

const DiscussionsTab = ({ courseId }: DiscussionsTabProps) => {
  return <DiscussionForum courseId={courseId} />;
};

export default DiscussionsTab;
